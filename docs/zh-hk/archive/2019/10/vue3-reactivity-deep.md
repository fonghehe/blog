---
title: "Vue 3 響應式系統深入：Proxy 替代 defineProperty 的原理"
date: 2019-10-23 17:10:53
tags:
  - Vue
readingTime: 1
description: "Vue 3 將響應式系統從 `Object.defineProperty` 完全重寫為 `Proxy`。這不是為了追時髦，而是為了徹底解決 Vue 2 中一些根本性缺陷。"
---

Vue 3 將響應式系統從 `Object.defineProperty` 完全重寫為 `Proxy`。這不是為了追時髦，而是為了徹底解決 Vue 2 中一些根本性缺陷。

## Vue 2 的侷限

```javascript
// Vue 2 無法檢測到這些變更：

// 1. 直接添加新屬性
// this.obj.newProp = 'value'; // 不觸發更新！

// 2. 通過索引修改數組
// this.arr[0] = 'new'; // 不觸發更新！

// 必須用特殊 API
this.$set(this.obj, "newProp", "value");
this.$set(this.arr, 0, "new");
Vue.set(obj, key, value);
```

`Object.defineProperty` 在對象創建時遍歷屬性添加 getter/setter，所以後續新增的屬性自然沒有攔截。

## Vue 3 的 Proxy 方案

`Proxy` 可以攔截對象的所有操作，包括屬性新增和刪除：

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key); // 調用時追蹤依賴
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key); // 設置時觸發更新
      return result;
    },
    deleteProperty(target, key) {
      const result = Reflect.deleteProperty(target, key);
      trigger(target, key); // 刪除屬性也能檢測到！
      return result;
    },
  });
}
```

## track 和 trigger 原理

```javascript
// 依賴跟蹤系統
// WeakMap<目標對象, Map<屬性名, Set<副作用>>>
const targetMap = new WeakMap();
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  effects && effects.forEach((effect) => effect());
}

function effect(fn) {
  activeEffect = fn;
  fn(); // 執行時自動追蹤當前訪問了哪些屬性
  activeEffect = null;
}
```

## 簡單使用示例

```javascript
const state = reactive({ count: 0 });

// effect 會在 state.count 變化時重新執行
effect(() => {
  console.log("count is:", state.count);
});
// 輸出： count is: 0

state.count++; // 輸出： count is: 1
state.newKey = 2; // Proxy 能檢測到！輸出： count is: 1——這次 effect 依賴 newKey
```

## ref 封裝基本類型

```javascript
// 基本類型不能被 Proxy 攔截，用封裝對象處理
function ref(value) {
  const r = {
    get value() {
      track(r, "value");
      return value;
    },
    set value(newVal) {
      value = newVal;
      trigger(r, "value");
    },
  };
  return r;
}

const count = ref(0);
effect(() => console.log(count.value));
count.value++; // 觸發更新
```

## 總結

Vue 3 響應式系統的升級不只是技術選型的迭代，而是對原有設計侷限的一次徹底修正。`Proxy` 的全攔截能力 + `WeakMap`索引的依賴圖，這套設計已被證明性能和正確性都更好。
