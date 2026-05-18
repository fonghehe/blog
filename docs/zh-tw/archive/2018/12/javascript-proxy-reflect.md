---
title: "JavaScript Proxy 和 Reflect 超程式設計"
date: 2018-12-13 16:17:56
tags:
  - JavaScript
readingTime: 2
description: "Proxy 是 ES2015 加入的，但一直用得不多。Vue 3 的響應式系統基於 Proxy，是時候好好了解一下了。"
---

Proxy 是 ES2015 加入的，但一直用得不多。Vue 3 的響應式系統基於 Proxy，是時候好好了解一下了。

## Proxy 基礎

Proxy 可以攔截物件的各種操作：

```javascript
const handler = {
  // 攔截屬性讀取
  get(target, prop, receiver) {
    console.log(`讀取 ${prop}`);
    return Reflect.get(target, prop, receiver);
  },

  // 攔截屬性設定
  set(target, prop, value, receiver) {
    console.log(`設定 ${prop} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },

  // 攔截 delete
  deleteProperty(target, prop) {
    console.log(`刪除 ${prop}`);
    return Reflect.deleteProperty(target, prop);
  },

  // 攔截 in 運算子
  has(target, prop) {
    return prop !== "secret" && Reflect.has(target, prop);
  },
};

const obj = { name: "Alice", secret: "密碼" };
const proxy = new Proxy(obj, handler);

proxy.name; // 日誌：讀取 name
proxy.age = 25; // 日誌：設定 age = 25
"secret" in proxy; // false（被攔截了）
```

## 實現響應式（Vue 3 原理）

```javascript
function reactive(target) {
  return new Proxy(target, {
    get(target, prop, receiver) {
      // 依賴收集
      track(target, prop);
      const value = Reflect.get(target, prop, receiver);
      // 如果值是物件，遞迴代理
      return typeof value === "object" && value !== null
        ? reactive(value)
        : value;
    },

    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      // 觸發更新
      trigger(target, prop);
      return result;
    },
  });
}

const state = reactive({ count: 0, user: { name: "Alice" } });

effect(() => {
  console.log("count:", state.count); // 自動追蹤依賴
});

state.count++; // 觸發 effect 重新執行
state.user.name = "Bob"; // 深層屬性也能追蹤！（Object.defineProperty 做不到）
```

Vue 2 用 `Object.defineProperty` 不能：

- 檢測新增屬性（需要 `Vue.set`）
- 檢測陣列索引賦值

Vue 3 用 Proxy 解決了這些問題。

## Reflect：標準化物件操作

`Reflect` 提供了和 Proxy handler 方法對應的靜態方法：

```javascript
// 以前的寫法
Object.defineProperty(obj, "name", { value: "Alice" });
"name" in obj;
delete obj.name;

// Reflect 寫法（更統一，返回布林值表示是否成功）
Reflect.defineProperty(obj, "name", { value: "Alice" });
Reflect.has(obj, "name");
Reflect.deleteProperty(obj, "name");

// Reflect.get 確保 this 正確（receiver 引數）
Reflect.get(target, prop, receiver); // receiver 是 proxy 本身
```

## 實用應用：資料驗證

```javascript
function createValidator(target, validators) {
  return new Proxy(target, {
    set(target, prop, value) {
      const validator = validators[prop];
      if (validator && !validator(value)) {
        throw new TypeError(`${prop} 的值 "${value}" 不合法`);
      }
      return Reflect.set(target, prop, value);
    },
  });
}

const user = createValidator(
  {},
  {
    age: (v) => Number.isInteger(v) && v >= 0 && v <= 150,
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
);

user.age = 25; // ✅
user.age = -1; // ❌ TypeError
user.email = "invalid"; // ❌ TypeError
```

## 小結

- Proxy 攔截物件的各種操作（get/set/delete 等），能力比 defineProperty 強
- Reflect 提供統一的物件操作 API，通常和 Proxy handler 配合使用
- Vue 3 基於 Proxy 實現響應式，解決了 Vue 2 的新增屬性檢測問題
- Proxy 無法被 polyfill，只能在支援 ES2015+ 的環境使用
