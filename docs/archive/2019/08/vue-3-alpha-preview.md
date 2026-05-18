---
title: "Vue 3 Alpha 版本初探 Proxy 响应式"
date: 2019-08-14 16:33:13
tags:
  - Vue
readingTime: 3
description: "2019 年 Vue 团队发布了 Vue 3 的 Alpha 版本，其中最大的变化之一就是响应式系统从 `Object.defineProperty` 切换到了 ES6 的 `Proxy`。本文将从源码和实践两个角度，对比 Vue 2 和 Vue 3 在响应式实现上的差异，带你提前感受 Vue 3 的新特性。"
---

2019 年 Vue 团队发布了 Vue 3 的 Alpha 版本，其中最大的变化之一就是响应式系统从 `Object.defineProperty` 切换到了 ES6 的 `Proxy`。本文将从源码和实践两个角度，对比 Vue 2 和 Vue 3 在响应式实现上的差异，带你提前感受 Vue 3 的新特性。

## Vue 2 响应式的局限

Vue 2 使用 `Object.defineProperty` 拦截对象属性的读写。这个方案存在几个明显的缺陷：

### 1. 无法检测属性的添加和删除

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

### 2. 无法检测数组索引的变化

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

### 3. 初始化时需要递归遍历所有属性

Vue 2 在创建响应式对象时，会递归遍历所有属性并转换为 getter/setter。对于大型对象，这个过程有性能开销。

## Vue 3 Proxy 响应式实现

Vue 3 使用 `Proxy` 代理整个对象，从根本上解决了上述问题。

### 基本原理

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

### 使用示例

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

## Vue 3 Composition API 配合响应式

Vue 3 提供了 `reactive`、`ref`、`computed`、`watch` 等函数式 API：

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

## Proxy vs defineProperty 对比

| 特性 | defineProperty | Proxy |
|
------|---------------|-------|
| 属性添加/删除 | 无法检测 | 自动检测 |
| 数组索引修改 | 无法检测 | 自动检测 |
| 深层嵌套 | 初始化时全部递归 | 惰性代理，按需处理 |
| Map/Set | 不支持 | 可扩展支持 |
| 性能 | 初始化慢 | 初始化快，按需代理 |
| 兼容性 | IE9+ | 不支持 IE |

## ref 和 reactive 的选择

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

## toRefs 解决解构丢失响应式的问题

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

## 小结

- Vue 3 使用 `Proxy` 替代 `Object.defineProperty`，从根本上解决了 Vue 2 响应式的局限
- Proxy 可以拦截属性的添加、删除、数组索引修改等操作，无需特殊 API
- 惰性代理机制：只有访问到的深层属性才会被代理，初始化性能更好
- Composition API（`reactive`、`ref`、`computed`、`watch`）提供了更灵活的逻辑组织方式
- `ref` 用于基本类型，`reactive` 用于对象类型，`toRefs` 解决解构丢失响应式的问题
- Proxy 不支持 IE，Vue 3 正式放弃了 IE11 以下的支持
- Vue 3 Alpha 阶段，API 可能会有调整，但核心设计理念已经确定
