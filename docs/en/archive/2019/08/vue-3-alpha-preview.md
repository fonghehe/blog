---
title: "Vue 3 Alpha Preview: Proxy-Based Reactivity"
date: 2019-08-14 16:33:13
tags:
  - Vue
readingTime: 3
description: "In 2019 the Vue team released the Vue 3 Alpha. One of its biggest changes is that the reactivity system switched from `Object.defineProperty` to the ES6 `Proxy`. Looking at both the source and the practice, this article compares how Vue 2 and Vue 3 implement reactivity differently, and gives you an early taste of Vue 3's new features."
wordCount: 330
---

In 2019 the Vue team released the Vue 3 Alpha. One of its biggest changes is that the reactivity system switched from `Object.defineProperty` to the ES6 `Proxy`. Looking at both the source and the practice, this article compares how Vue 2 and Vue 3 implement reactivity differently, and gives you an early taste of Vue 3's new features.

## Vue 2 Reactivity Limitations

Vue 2 uses `Object.defineProperty` to intercept reads and writes on object properties. This approach has a few obvious flaws:

### 1. Cannot Detect Property Addition and Deletion

```js
// Vue 2
const vm = new Vue({
  data() {
    return {
      user: { name: '张三' }
    };
  },
  methods: {
    addAge() {
      // 这个操作 Vue 2 无法检测到！
      this.user.age = 25;
      // 需要使用 Vue.set 才能触发响应式更新
      this.$set(this.user, 'age', 25);
    }
  }
});
```

### 2. Cannot Detect Array Index Changes

```js
// Vue 2
const vm = new Vue({
  data() {
    return {
      list: [1, 2, 3]
    };
  },
  methods: {
    updateFirst() {
      // 不会触发视图更新
      this.list[0] = 100;
      // 必须使用 splice
      this.$set(this.list, 0, 100);
    }
  }
});
```

### 3. Recursive Traversal of All Properties at Initialization

When creating a reactive object, Vue 2 recursively walks every property and converts it to a getter/setter. For large objects, that has a performance cost.

## Vue 3 Proxy Reactivity Implementation

Vue 3 uses a `Proxy` to wrap the whole object, solving the problems above at the root.

### Basic Principles

```js
// 手写一个简化的 Vue 3 响应式系统
let activeEffect = null;

function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      // 收集依赖
      if (activeEffect) {
        track(target, key);
      }
      const result = Reflect.get(target, key, receiver);
      // 深层代理：只有访问到的属性才会被代理（惰性）
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      return result;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      // 只有值真正改变时才触发更新
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);
      // 删除属性也能触发更新
      if (hadKey && result) {
        trigger(target, key);
      }
      return result;
    },

    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },

    ownKeys(target) {
      track(target, 'iterate');
      return Reflect.ownKeys(target);
    }
  };

  return new Proxy(target, handler);
}

// 依赖存储
const targetMap = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;

  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;

  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach(effect => effect());
  }
}

function effect(fn) {
  activeEffect = fn;
  fn(); // 立即执行一次以收集依赖
  activeEffect = null;
}
```

### Usage Example

```js
const state = reactive({
  count: 0,
  user: {
    name: '张三',
    hobbies: ['coding', 'reading'],
  },
});

// 自动收集依赖
effect(() => {
  console.log(`count: ${state.count}`);
});

effect(() => {
  console.log(`用户: ${state.user.name}`);
});

state.count = 1;          // 输出: count: 1
state.user.name = '李四'; // 输出: 用户: 李四

// 动态添加属性 —— 自动变为响应式
state.user.age = 25; // 这在 Vue 3 中完全可以工作！

// 删除属性 —— 自动触发更新
delete state.user.age; // 也能正确触发更新

// 数组操作 —— 直接通过索引修改
state.user.hobbies[0] = 'gaming'; // 完全支持！
```

## Vue 3 Composition API with Reactivity

Vue 3 provides the functional APIs `reactive`, `ref`, `computed`, and `watch`:

```js
import { reactive, ref, computed, watch, toRefs } from 'vue';

// reactive 用于对象类型
const state = reactive({
  firstName: '张',
  lastName: '三',
  age: 25,
});

// computed 计算属性
const fullName = computed(() => {
  return `${state.firstName}${state.lastName}`;
});

// ref 用于基本类型
const count = ref(0);

// watch 监听变化
watch(
  () => state.age,
  (newVal, oldVal) => {
    console.log(`年龄从 ${oldVal} 变为 ${newVal}`);
  }
);

// 在模板中使用
state.age = 26; // 触发 watch 和视图更新
count.value++;  // ref 需要通过 .value 访问
```

## Proxy vs defineProperty Comparison

| Feature | defineProperty | Proxy |
|------|---------------|-------|
| Property add/delete | Cannot detect | Auto-detected |
| Array index changes | Cannot detect | Auto-detected |
| Deep nesting | Full recursive traversal at init | Lazy proxy, on demand |
| Map/Set | Not supported | Can be extended to support |
| Performance | Slow initialization | Fast init, lazy proxying |
| Compatibility | IE9+ | No IE support |

## Choosing Between ref and reactive

```js
import { ref, reactive } from 'vue';

// ref: 适用于基本类型和需要整体替换的数据
const count = ref(0);
const list = ref([]);
const name = ref('张三');

// reactive: 适用于对象类型
const user = reactive({
  name: '张三',
  age: 25,
});

// 模板中 ref 会自动解包，不需要 .value
// 但在 JS 中必须使用 .value
count.value++;
console.log(count.value); // 2

// 实际项目中的最佳实践
function useUser() {
  const user = reactive({
    name: '',
    email: '',
    age: 0,
  });

  const isValid = computed(() => {
    return user.name.length > 0 && user.email.includes('@');
  });

  function reset() {
    user.name = '';
    user.email = '';
    user.age = 0;
  }

  return {
    ...toRefs(user), // 将 reactive 对象转为 ref 集合，方便解构
    isValid,
    reset,
  };
}

// 在组件中使用
const { name, email, age, isValid, reset } = useUser();
```

## Solving Reactivity Loss on Destructure with toRefs

```js
import { reactive, toRefs } from 'vue';

function useCounter() {
  const state = reactive({
    count: 0,
    doubled: computed(() => state.count * 2),
  });

  const increment = () => state.count++;
  const decrement = () => state.count--;

  // 直接解构会丢失响应式
  // return { count: state.count, increment }; // 错误！

  // 使用 toRefs 保持响应式
  return {
    ...toRefs(state),
    increment,
    decrement,
  };
}

// 使用时可以安全解构
const { count, doubled, increment } = useCounter();
// count 和 doubled 都是 ref，保持响应式
```

## Summary

- Vue 3 replaces `Object.defineProperty` with `Proxy`, fundamentally fixing Vue 2's reactivity limitations.
- `Proxy` can intercept property addition, deletion, and array-index changes without any special API.
- Lazy proxying: only deeply accessed properties get proxied, so initialization is faster.
- The Composition API (`reactive`, `ref`, `computed`, `watch`) offers a more flexible way to organize logic.
- Use `ref` for primitives, `reactive` for objects, and `toRefs` to avoid losing reactivity when destructuring.
- `Proxy` doesn't support IE, so Vue 3 officially dropped support for IE11 and below.
- Vue 3 is still in Alpha, so the API may shift, but the core design is settled.
