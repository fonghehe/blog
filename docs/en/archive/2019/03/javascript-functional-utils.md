---
title: "JavaScript Functional Utility Functions: compose, curry, and pipe"
date: 2019-03-20 14:49:34
tags:
  - JavaScript
readingTime: 1
description: "The core utility functions of functional programming are not as remote as they seem. Redux middleware, Lodash/fp, and RxJS operators are all built on these idea"
wordCount: 59
---

The core utility functions of functional programming are not as remote as they seem. Redux middleware, Lodash/fp, and RxJS operators are all built on these ideas. Implementing them by hand gives you a complete understanding.

## curry: Currying Functions

Convert a multi-parameter function into one that can receive its arguments incrementally:

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

// Usage
const add = curry((a, b, c) => a + b + c);
console.log(add(1)(2)(3)); // 6
console.log(add(1, 2)(3)); // 6
console.log(add(1)(2, 3)); // 6

// Practical use case: partial application
const multiply = curry((multiplier, value) => value * multiplier);
const double = multiply(2);
const triple = multiply(3);
console.log([1, 2, 3, 4].map(double)); // [2, 4, 6, 8]
```

## compose: Right-to-Left Execution (reduce implementation)

```javascript
const compose = (...fns) => {
  return (x) => fns.reduceRight((acc, fn) => fn(acc), x);
};

// pipe is the reversed version of compose (left-to-right)
const pipe = (...fns) => {
  return (x) => fns.reduce((acc, fn) => fn(acc), x);
};

// Example
const toUpperCase = (s) => s.toUpperCase();
const trim = (s) => s.trim();
const addExclaim = (s) => s + "!";
const replaceSpaces = (s) => s.replace(/ /g, "_");

const transform = pipe(trim, toUpperCase, replaceSpaces, addExclaim);
console.log(transform("  hello world  ")); // 'HELLO_WORLD!'
```

## Real-World Application

```javascript
// Redux's applyMiddleware uses compose
const applyMiddleware =
  (...middlewares) =>
  (createStore) =>
  (reducer, ...args) => {
    const store = createStore(reducer, ...args);
    // Build the middleware chain
    const dispatch = compose(...middlewares.map((mw) => mw(store)))(
      store.dispatch,
    );
    return { ...store, dispatch };
  };

// Form validation pipeline
const validateEmail = pipe(
  trim,
  (v) => v.toLowerCase(),
  (v) => ({ value: v, valid: /^[^@]+@[^@]+\.[^@]+$/.test(v) }),
);
console.log(validateEmail("  User@Email.com  "));
// { value: 'user@email.com', valid: true }
```

## memoize: Memoization

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

// Expensive computation runs only once
```
