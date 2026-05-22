---
title: "Vue 3 Alpha 版本初探 Proxy 響應式"
date: 2019-08-14 16:33:13
tags:
  - Vue
readingTime: 3
description: "2019 年 Vue 團隊釋出了 Vue 3 的 Alpha 版本，其中最大的變化之一就是響應式系統從 `Object.defineProperty` 切換到了 ES6 的 `Proxy`。本文將從原始碼和實踐兩個角度，對比 Vue 2 和 Vue 3 在響應式實現上的差異，帶你提前感受 Vue 3 的新特性。"
wordCount: 537
---

2019 年 Vue 團隊釋出了 Vue 3 的 Alpha 版本，其中最大的變化之一就是響應式系統從 `Object.defineProperty` 切換到了 ES6 的 `Proxy`。本文將從原始碼和實踐兩個角度，對比 Vue 2 和 Vue 3 在響應式實現上的差異，帶你提前感受 Vue 3 的新特性。

## Vue 2 響應式的侷限

Vue 2 使用 `Object.defineProperty` 攔截物件屬性的讀寫。這個方案存在幾個明顯的缺陷：

### 1. 無法檢測屬性的新增和刪除

```js
// Vue 2
const vm = new Vue({
  data() {
    return {
      user: { name: '張三' }
    };
  },
  methods: {
    addAge() {
      // 這個操作 Vue 2 無法檢測到！
      this.user.age = 25;
      // 需要使用 Vue.set 才能觸發響應式更新
      this.$set(this.user, 'age', 25);
    }
  }
});
```

### 2. 無法檢測陣列索引的變化

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
      // 不會觸發檢視更新
      this.list[0] = 100;
      // 必須使用 splice
      this.$set(this.list, 0, 100);
    }
  }
});
```

### 3. 初始化時需要遞迴遍歷所有屬性

Vue 2 在建立響應式物件時，會遞迴遍歷所有屬性並轉換為 getter/setter。對於大型物件，這個過程有效能開銷。

## Vue 3 Proxy 響應式實現

Vue 3 使用 `Proxy` 代理整個物件，從根本上解決了上述問題。

### 基本原理

```js
// 手寫一個簡化的 Vue 3 響應式系統
let activeEffect = null;

function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      // 收集依賴
      if (activeEffect) {
        track(target, key);
      }
      const result = Reflect.get(target, key, receiver);
      // 深層代理：隻有訪問到的屬性才會被代理（惰性）
      if (typeof result === 'object' && result !== null) {
        return reactive(result);
      }
      return result;
    },

    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(target, key, value, receiver);
      // 隻有值真正改變時才觸發更新
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);
      // 刪除屬性也能觸發更新
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

// 依賴儲存
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
  fn(); // 立即執行一次以收集依賴
  activeEffect = null;
}
```

### 使用示例

```js
const state = reactive({
  count: 0,
  user: {
    name: '張三',
    hobbies: ['coding', 'reading'],
  },
});

// 自動收集依賴
effect(() => {
  console.log(`count: ${state.count}`);
});

effect(() => {
  console.log(`使用者: ${state.user.name}`);
});

state.count = 1;          // 輸出: count: 1
state.user.name = '李四'; // 輸出: 使用者: 李四

// 動態新增屬性 —— 自動變為響應式
state.user.age = 25; // 這在 Vue 3 中完全可以工作！

// 刪除屬性 —— 自動觸發更新
delete state.user.age; // 也能正確觸發更新

// 陣列操作 —— 直接通過索引修改
state.user.hobbies[0] = 'gaming'; // 完全支援！
```

## Vue 3 Composition API 配合響應式

Vue 3 提供了 `reactive`、`ref`、`computed`、`watch` 等函式式 API：

```js
import { reactive, ref, computed, watch, toRefs } from 'vue';

// reactive 用於物件型別
const state = reactive({
  firstName: '張',
  lastName: '三',
  age: 25,
});

// computed 計算屬性
const fullName = computed(() => {
  return `${state.firstName}${state.lastName}`;
});

// ref 用於基本型別
const count = ref(0);

// watch 監聽變化
watch(
  () => state.age,
  (newVal, oldVal) => {
    console.log(`年齡從 ${oldVal} 變為 ${newVal}`);
  }
);

// 在模板中使用
state.age = 26; // 觸發 watch 和檢視更新
count.value++;  // ref 需要通過 .value 訪問
```

## Proxy vs defineProperty 對比

| 特性 | defineProperty | Proxy |
|
------|---------------|-------|
| 屬性新增/刪除 | 無法檢測 | 自動檢測 |
| 陣列索引修改 | 無法檢測 | 自動檢測 |
| 深層巢狀 | 初始化時全部遞迴 | 惰性代理，按需處理 |
| Map/Set | 不支援 | 可擴充套件支援 |
| 效能 | 初始化慢 | 初始化快，按需代理 |
| 相容性 | IE9+ | 不支援 IE |

## ref 和 reactive 的選擇

```js
import { ref, reactive } from 'vue';

// ref: 適用於基本型別和需要整體替換的資料
const count = ref(0);
const list = ref([]);
const name = ref('張三');

// reactive: 適用於物件型別
const user = reactive({
  name: '張三',
  age: 25,
});

// 範本中 ref 會自動解包，不需要 .value
// 但在 JS 中必須使用 .value
count.value++;
console.log(count.value); // 2

// 實際專案中的最佳實踐
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
    ...toRefs(user), // 將 reactive 物件轉為 ref 集合，方便解構
    isValid,
    reset,
  };
}

// 在元件中使用
const { name, email, age, isValid, reset } = useUser();
```

## toRefs 解決解構丟失響應式的問題

```js
import { reactive, toRefs } from 'vue';

function useCounter() {
  const state = reactive({
    count: 0,
    doubled: computed(() => state.count * 2),
  });

  const increment = () => state.count++;
  const decrement = () => state.count--;

  // 直接解構會丟失響應式
  // return { count: state.count, increment }; // 錯誤！

  // 使用 toRefs 保持響應式
  return {
    ...toRefs(state),
    increment,
    decrement,
  };
}

// 使用時可以安全解構
const { count, doubled, increment } = useCounter();
// count 和 doubled 都是 ref，保持響應式
```

## 小結

- Vue 3 使用 `Proxy` 替代 `Object.defineProperty`，從根本上解決了 Vue 2 響應式的侷限
- Proxy 可以攔截屬性的新增、刪除、陣列索引修改等操作，無需特殊 API
- 惰性代理機製：隻有訪問到的深層屬性才會被代理，初始化效能更好
- Composition API（`reactive`、`ref`、`computed`、`watch`）提供了更靈活的邏輯組織方式
- `ref` 用於基本型別，`reactive` 用於物件型別，`toRefs` 解決解構丟失響應式的問題
- Proxy 不支援 IE，Vue 3 正式放棄了 IE11 以下的支援
- Vue 3 Alpha 階段，API 可能會有調整，但核心設計理念已經確定
