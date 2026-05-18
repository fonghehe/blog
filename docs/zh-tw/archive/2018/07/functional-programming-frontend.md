---
title: "防抖節流之外：函數語言程式設計思想在前端的應用"
date: 2018-07-03 10:12:42
tags:
  - 前端
readingTime: 2
description: "最近讀了一些函數語言程式設計的資料，發現很多思想其實在前端開發裡早就在用，只是沒有明確意識到。整理一下有實際價值的部分。"
---

最近讀了一些函數語言程式設計的資料，發現很多思想其實在前端開發裡早就在用，只是沒有明確意識到。整理一下有實際價值的部分。

## 純函式：可預測的函式

純函式有兩個特性：

1. 相同輸入永遠返回相同輸出
2. 沒有副作用（不修改外部狀態）

```javascript
// ❌ 不是純函式：結果依賴外部變數
let discount = 0.9;
function getPrice(price) {
  return price * discount; // discount 變化會影響結果
}

// ✅ 純函式
function getPrice(price, discount) {
  return price * discount; // 相同輸入永遠相同輸出
}
```

純函式的好處：

- 易於測試（不需要 mock 外部狀態）
- 易於快取（相同輸入 = 相同輸出，可以記憶化）
- 易於推理（不用擔心副作用）

## 函式組合

將多個小函式組合成複雜的資料處理管道：

```javascript
// 原始寫法：巢狀呼叫
const result = sanitize(trim(toLowerCase(input)));

// 函式組合
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const processInput = pipe(toLowerCase, trim, sanitize);

const result = processInput(input); // 從左到右執行
```

實際應用場景：

```javascript
// 資料處理管道
const processUsers = pipe(
  (users) => users.filter((u) => u.isActive),
  (users) => users.map((u) => ({ ...u, name: u.name.trim() })),
  (users) => users.sort((a, b) => a.name.localeCompare(b.name)),
);

const activeUsers = processUsers(rawUsers);
```

## 柯里化（Currying）

將多引數函式轉為單引數函式序列：

```javascript
// 普通函式
function add(a, b) {
  return a + b;
}

// 柯里化
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

// 箭頭函式簡寫
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5); // 固定第一個引數
add5(3); // 8
add5(10); // 15
```

實際應用：

```javascript
// 引數化的驗證函式
const minLength = (min) => (str) => str.length >= min;
const maxLength = (max) => (str) => str.length <= max;
const isEmail = (str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const validators = {
  username: [minLength(3), maxLength(20)],
  email: [isEmail],
  password: [minLength(8)],
};

function validate(value, rules) {
  return rules.every((rule) => rule(value));
}

validate("alice", validators.username); // true
validate("ab", validators.username); // false（太短）
```

## 不可變資料

避免直接修改資料，而是建立新資料：

```javascript
// ❌ 直接修改
function updateUser(user, newName) {
  user.name = newName; // 修改了原物件
  return user;
}

// ✅ 建立新物件
function updateUser(user, newName) {
  return { ...user, name: newName };
}

// 陣列操作
// ❌ 直接修改
list.push(newItem);
list.splice(index, 1);

// ✅ 不可變操作
const newList = [...list, newItem];
const filteredList = list.filter((_, i) => i !== index);
```

不可變資料的好處：

- 更容易追蹤變化（old 和 new 都有，可以對比）
- Vue/React 的變化檢測更可靠
- 時間旅行除錯（Redux DevTools）成為可能

## 在 Vue 中應用

```javascript
// 計算屬性（純函式）
computed: {
  filteredList() {
    // 不修改 this.list，返回新陣列
    return this.list
      .filter(item => item.status === this.filterStatus)
      .map(item => ({ ...item, label: item.name.toUpperCase() }))
  }
}
```

```javascript
// Vuex mutations 保持不可變性
mutations: {
  UPDATE_USER(state, payload) {
    // ✅ 用展開運算子建立新物件
    state.users = state.users.map(user =>
      user.id === payload.id
        ? { ...user, ...payload.changes }
        : user
    )
  }
}
```

## 小結

函式式思想不需要全盤引入，實用的部分：

- **純函式**：工具函式儘量寫成純函式，便於測試
- **不可變資料**：狀態管理裡遵循不可變原則
- **函式組合**：複雜資料處理用 pipe 組織，比巢狀呼叫清晰
- 不必追求"函式式純粹"，和命令式混合使用完全沒問題
