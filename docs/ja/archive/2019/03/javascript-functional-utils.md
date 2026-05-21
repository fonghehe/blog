---
title: "JavaScriptの関数型ユーティリティ関数：compose、curry、pipe"
date: 2019-03-20 14:49:34
tags:
  - JavaScript
readingTime: 1
description: "関数型プログラミングのコアユーティリティ関数は、実際のプロジェクトでも遠い存在ではない。Reduxミドルウェア、Lodash/fp、RxJSオペレーターの背後にはすべてこれらの考え方がある。手で実装することで完全に理解できる。"
wordCount: 157
---

関数型プログラミングのコアユーティリティ関数は、実際のプロジェクトでも遠い存在ではない。Reduxミドルウェア、Lodash/fp、RxJSオペレーターの背後にはすべてこれらの考え方がある。手で実装することで完全に理解できる。

## curry：関数のカリー化

複数引数の関数を段階的に引数を受け取れる関数に変換する：

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

// 使い方
const add = curry((a, b, c) => a + b + c);
console.log(add(1)(2)(3)); // 6
console.log(add(1, 2)(3)); // 6
console.log(add(1)(2, 3)); // 6

// 実用的なユースケース：部分適用
const multiply = curry((multiplier, value) => value * multiplier);
const double = multiply(2);
const triple = multiply(3);
console.log([1, 2, 3, 4].map(double)); // [2, 4, 6, 8]
```

## compose：右から左への実行（reduceによる実装）

```javascript
const compose = (...fns) => {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
};

// pipeはcomposeの逆順版（左から右）
const pipe = (...fns) => {
  return (x) => fns.reduce((acc, fn) => fn(acc), x);
};

// 例
const toUpperCase = (s) => s.toUpperCase();
const trim = (s) => s.trim();
const addExclaim = (s) => s + "!";
const replaceSpaces = (s) => s.replace(/ /g, "_");

const transform = pipe(trim, toUpperCase, replaceSpaces, addExclaim);
console.log(transform("  hello world  ")); // 'HELLO_WORLD!'
```

## 実際のプロジェクトへの応用

```javascript
// ReduxのapplyMiddlewareはcomposeを使っている
const applyMiddleware =
  (...middlewares) =>
  (createStore) =>
  (reducer, ...args) => {
    const store = createStore(reducer, ...args);
    // ミドルウェアチェーンを構築
    const dispatch = compose(...middlewares.map((mw) => mw(store)))(
      store.dispatch,
    );
    return { ...store, dispatch };
  };

// フォームバリデーションパイプライン
const validateEmail = pipe(
  trim,
  (v) => v.toLowerCase(),
  (v) => ({ value: v, valid: /^[^@]+@[^@]+\.[^@]+$/.test(v) }),
);
console.log(validateEmail("  User@Email.com  "));
// { value: 'user@email.com', valid: true }
```

## memoize：メモ化

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

// 重い計算は一度だけ実行される
```
