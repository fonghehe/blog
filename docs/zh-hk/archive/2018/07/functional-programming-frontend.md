---
title: "防抖節流之外：函數式編程思想在前端的應用"
date: 2018-07-03 10:12:42
tags:
  - 前端
readingTime: 2
description: "最近讀了一些函數式編程的資料，發現很多思想其實在前端開發裏早就在用，隻是沒有明確意識到。整理一下有實際價值的部分。"
wordCount: 384
---

最近讀了一些函數式編程的資料，發現很多思想其實在前端開發裏早就在用，隻是沒有明確意識到。整理一下有實際價值的部分。

## 純函數：可預測的函數

純函數有兩個特性：

1. 相同輸入永遠返回相同輸出
2. 沒有副作用（不修改外部狀態）

```javascript
// ❌ 不是純函數：結果依賴外部變量
let discount = 0.9;
function getPrice(price) {
  return price * discount; // discount 變化會影響結果
}

// ✅ 純函數
function getPrice(price, discount) {
  return price * discount; // 相同輸入永遠相同輸出
}
```

純函數的好處：

- 易於測試（不需要 mock 外部狀態）
- 易於緩存（相同輸入 = 相同輸出，可以記憶化）
- 易於推理（不用擔心副作用）

## 函數組合

將多個小函數組合成複雜的數據處理管道：

```javascript
// 原始寫法：嵌套調用
const result = sanitize(trim(toLowerCase(input)));

// 函數組合
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
// 數據處理管道
const processUsers = pipe(
  (users) => users.filter((u) => u.isActive),
  (users) => users.map((u) => ({ ...u, name: u.name.trim() })),
  (users) => users.sort((a, b) => a.name.localeCompare(b.name)),
);

const activeUsers = processUsers(rawUsers);
```

## 柯里化（Currying）

將多參數函數轉為單參數函數序列：

```javascript
// 普通函數
function add(a, b) {
  return a + b;
}

// 柯里化
function curriedAdd(a) {
  return function (b) {
    return a + b;
  };
}

// 箭頭函數簡寫
const curriedAdd = (a) => (b) => a + b;

const add5 = curriedAdd(5); // 固定第一個參數
add5(3); // 8
add5(10); // 15
```

實際應用：

```javascript
// 參數化的驗證函數
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

## 不可變數據

避免直接修改數據，而是創建新數據：

```javascript
// ❌ 直接修改
function updateUser(user, newName) {
  user.name = newName; // 修改了原對象
  return user;
}

// ✅ 創建新對象
function updateUser(user, newName) {
  return { ...user, name: newName };
}

// 數組操作
// ❌ 直接修改
list.push(newItem);
list.splice(index, 1);

// ✅ 不可變操作
const newList = [...list, newItem];
const filteredList = list.filter((_, i) => i !== index);
```

不可變數據的好處：

- 更容易追蹤變化（old 和 new 都有，可以對比）
- Vue/React 的變化檢測更可靠
- 時間旅行調試（Redux DevTools）成為可能

## 在 Vue 中應用

```javascript
// 計算屬性（純函數）
computed: {
  filteredList() {
    // 不修改 this.list，返回新數組
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
    // ✅ 用展開運算符創建新對象
    state.users = state.users.map(user =>
      user.id === payload.id
        ? { ...user, ...payload.changes }
        : user
    )
  }
}
```

## 小結

函數式思想不需要全盤引入，實用的部分：

- **純函數**：工具函數儘量寫成純函數，便於測試
- **不可變數據**：狀態管理裏遵循不可變原則
- **函數組合**：複雜數據處理用 pipe 組織，比嵌套調用清晰
- 不必追求"函數式純粹"，和命令式混合使用完全沒問題
