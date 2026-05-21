---
title: "JavaScript 函數語言程式設計實踐"
date: 2019-04-13 11:22:26
tags:
  - 前端
readingTime: 1
description: "函數語言程式設計在前端圈一直有熱度，Redux、RxJS 都有它的影子。整理一些實際能用上的概念。"
wordCount: 168
---

函數語言程式設計在前端圈一直有熱度，Redux、RxJS 都有它的影子。整理一些實際能用上的概念。

## 純函式

```javascript
// 純函式：相同輸入始終相同輸出，無副作用
const add = (a, b) => a + b; // ✅ 純函式

// 非純函式
let count = 0;
const increment = () => ++count; // ❌ 有副作用

const getDate = () => new Date(); // ❌ 結果不確定
```

純函式好處：可測試、可快取、可並行。

## 高階函式

```javascript
// 接受或返回函式的函式
const map = (fn) => (arr) => arr.map(fn);
const filter = (fn) => (arr) => arr.filter(fn);
const reduce = (fn, init) => (arr) => arr.reduce(fn, init);

const double = (x) => x * 2;
const isEven = (x) => x % 2 === 0;

const numbers = [1, 2, 3, 4, 5];

// 鏈式處理
const result = numbers
  .filter(isEven) // [2, 4]
  .map(double) // [4, 8]
  .reduce((acc, n) => acc + n, 0); // 12
```

## 柯里化（Currying）

```javascript
// 把多引數函式轉為一系列單引數函式
const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

const add = curry((a, b, c) => a + b + c);

add(1)(2)(3); // 6
add(1, 2)(3); // 6
add(1)(2, 3); // 6

// 實用示例：複用部分引數
const addTax = add(0);
const fivePercentTax = addTax(0.05);

// 配合 map 使用
const prices = [100, 200, 300];
const withTax = prices.map((price) => fivePercentTax(price));
```

## 函式組合

```javascript
// compose：從右到左
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

// pipe：從左到右（更直觀）
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

const trim = (s) => s.trim();
const lower = (s) => s.toLowerCase();
const split = (s) => s.split(" ");

const processInput = pipe(trim, lower, split);
processInput("  Hello World  "); // ['hello', 'world']
```

## 不可變資料

```javascript
// 不直接修改，返回新物件
const state = { user: { name: "Alice", age: 25 }, count: 0 };

// ❌ 直接修改
state.count = 1;
state.user.age = 26;

// ✅ 返回新物件（淺複製）
const newState = {
  ...state,
  count: state.count + 1,
  user: { ...state.user, age: 26 },
};

// Immer：更優雅地處理不可變更新
import produce from "immer";

const nextState = produce(state, (draft) => {
  draft.count += 1;
  draft.user.age = 26; // 像直接修改，但返回新物件
});
```

## 在 Redux 中的應用

```javascript
// reducer 就是純函式 + 不可變更新
function todosReducer(state = [], action) {
  switch (action.type) {
    case "ADD_TODO":
      return [...state, { id: Date.now(), text: action.text, done: false }];

    case "TOGGLE_TODO":
      return state.map((todo) =>
        todo.id === action.id ? { ...todo, done: !todo.done } : todo,
      );

    case "REMOVE_TODO":
      return state.filter((todo) => todo.id !== action.id);

    default:
      return state;
  }
}
```

## 小結

- 純函式：無副作用，相同輸入相同輸出，便於測試和快取
- 柯里化：固定部分引數，建立特化函式
- compose/pipe：組合小函式成大函式
- 不可變資料：不修改原資料，Immer 讓寫法更自然
- 不必"全函式式"，在合適的地方用這些概念就夠了
