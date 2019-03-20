---
title: "JavaScript 函数式工具函数：compose、curry 与 pipe"
date: 2019-03-20 14:49:34
tags:
  - JavaScript
---

函数式编程的核心工具函数在实际项目中并不远。Redux middleware、Lodash/fp、RxJS 操作符背后都是这些思想。手写实现能帮你完全吹散它们。

## curry 梯度化

将一个多参数函数转成尚可以逐步接收参数的函数：

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

// 实用场景：部分应用
const multiply = curry((multiplier, value) => value * multiplier);
const double = multiply(2);
const triple = multiply(3);
console.log([1, 2, 3, 4].map(double)); // [2, 4, 6, 8]
```

## compose 左到右执行（reduce 实现）

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

## 实际项目中的应用

```javascript
// Redux 中的 applyMiddleware 就是 compose
const applyMiddleware =
  (...middlewares) =>
  (createStore) =>
  (reducer, ...args) => {
    const store = createStore(reducer, ...args);
    // 构建中间件链
    const dispatch = compose(...middlewares.map((mw) => mw(store)))(
      store.dispatch,
    );
    return { ...store, dispatch };
  };

// 表单验证管道
const validateEmail = pipe(
  trim,
  (v) => v.toLowerCase(),
  (v) => ({ value: v, valid: /^[^@]+@[^@]+\.[^@]+$/.test(v) }),
);
console.log(validateEmail("  User@Email.com  "));
// { value: 'user@email.com', valid: true }
```

## memoize 记忆化

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

// 昂贵计算只执行一次
const expensiveFn = memoize((n) => {
  // 模拟耗时计算
  return n * n;
});
```

## once 只执行一次

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

// 加载配置只初始化一次
const initConfig = once(async () => {
  const config = await fetch("/api/config").then((r) => r.json());
  return config;
});
```

## 总结

`curry`、`compose`、`pipe`、`memoize`、`once` 这五个工具函数是函数式工具箱的核心。它们小、纯、可组合，是建立更大抽象的基础。
