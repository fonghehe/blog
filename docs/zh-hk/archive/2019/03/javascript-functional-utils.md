---
title: "JavaScript 函數式工具函數：compose、curry 與 pipe"
date: 2019-03-20 14:49:34
tags:
  - JavaScript
readingTime: 1
description: "函數式編程的核心工具函數在實際項目中並不遠。Redux middleware、Lodash/fp、RxJS 操作符背後都是這些思想。手寫實現能幫你完全吹散它們。"
wordCount: 141
---

函數式編程的核心工具函數在實際項目中並不遠。Redux middleware、Lodash/fp、RxJS 操作符背後都是這些思想。手寫實現能幫你完全吹散它們。

## curry 梯度化

將一個多參數函數轉成尚可以逐步接收參數的函數：

```javascript
const curry = (fn) => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) {
      return fn(...args);
    }
    return (...moreArgs) => curried(...args, ...moreArgs);
  };
};

// 使用
const add = curry((a, b, c) => a + b + c);
console.log(add(1)(2)(3)); // 6
console.log(add(1, 2)(3)); // 6
console.log(add(1)(2, 3)); // 6

// 實用場景：部分應用
const multiply = curry((multiplier, value) => value * multiplier);
const double = multiply(2);
const triple = multiply(3);
console.log([1, 2, 3, 4].map(double)); // [2, 4, 6, 8]
```

## compose 左到右執行（reduce 實現）

```javascript
const compose = (...fns) => {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
};

// pipe 是 compose 的逆序版（左到右）
const pipe = (...fns) => {
  return (x) => fns.reduce((acc, fn) => fn(acc), x);
};

// 示例
const toUpperCase = (s) => s.toUpperCase();
const trim = (s) => s.trim();
const addExclaim = (s) => s + "!";
const replaceSpaces = (s) => s.replace(/ /g, "_");

const transform = pipe(trim, toUpperCase, replaceSpaces, addExclaim);
console.log(transform("  hello world  ")); // 'HELLO_WORLD!'
```

## 實際項目中的應用

```javascript
// Redux 中的 applyMiddleware 就是 compose
const applyMiddleware =
  (...middlewares) =>
  (createStore) =>
  (reducer, ...args) => {
    const store = createStore(reducer, ...args);
    // 構建中間件鏈
    const dispatch = compose(...middlewares.map((mw) => mw(store)))(
      store.dispatch,
    );
    return { ...store, dispatch };
  };

// 表單驗證管道
const validateEmail = pipe(
  trim,
  (v) => v.toLowerCase(),
  (v) => ({ value: v, valid: /^[^@]+@[^@]+\.[^@]+$/.test(v) }),
);
console.log(validateEmail("  User@Email.com  "));
// { value: 'user@email.com', valid: true }
```

## memoize 記憶化

```javascript
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// 昂貴計算只執行一次
const expensiveFn = memoize((n) => {
  // 模擬耗時計算
  return n * n;
});
```

## once 只執行一次

```javascript
const once = (fn) => {
  let called = false;
  let result;
  return (...args) => {
    if (!called) {
      called = true;
      result = fn(...args);
    }
    return result;
  };
};

// 加載配置只初始化一次
const initConfig = once(async () => {
  const config = await fetch("/api/config").then((r) => r.json());
  return config;
});
```

## 總結

`curry`、`compose`、`pipe`、`memoize`、`once` 這五個工具函數是函數式工具箱的核心。它們小、純、可組合，是建立更大抽象的基礎。
