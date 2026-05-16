---
title: "Practical Functional Programming in JavaScript"
date: 2019-04-13 11:22:26
tags:
  - Frontend
readingTime: 1
description: "Functional programming has always been a hot topic in the frontend community — Redux and RxJS both borrow heavily from it. Here are some concepts that are actua"
---

Functional programming has always been a hot topic in the frontend community — Redux and RxJS both borrow heavily from it. Here are some concepts that are actually useful in practice.

## Pure Functions

```javascript
// Pure function: same input always produces same output, no side effects
const add = (a, b) => a + b; // ✅ pure function

// Impure functions
let count = 0;
const increment = () => ++count; // ❌ has side effects

const getDate = () => new Date(); // ❌ non-deterministic result
```

Benefits of pure functions: testable, cacheable, parallelizable.

## Higher-Order Functions

```javascript
// Functions that accept or return other functions
const map = (fn) => (arr) => arr.map(fn);
const filter = (fn) => (arr) => arr.filter(fn);
const reduce = (fn, init) => (arr) => arr.reduce(fn, init);

const double = (x) => x * 2;
const isEven = (x) => x % 2 === 0;

const numbers = [1, 2, 3, 4, 5];

// Chain processing
const result = numbers
  .filter(isEven) // [2, 4]
  .map(double) // [4, 8]
  .reduce((acc, n) => acc + n, 0); // 12
```

## Currying

```javascript
// Transform a multi-argument function into a series of single-argument functions
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

// Practical example: reusing partial arguments
const addTax = add(0);
const fivePercentTax = addTax(0.05);

// Using with map
const prices = [100, 200, 300];
const withTax = prices.map((price) => fivePercentTax(price));
```

## Function Composition

```javascript
// compose: right to left
const compose =
  (...fns) =>
  (x) =>
    fns.reduceRight((acc, fn) => fn(acc), x);

// pipe: left to right (more intuitive)
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

## Immutable Data

```javascript
// Don't mutate directly — return new objects
const updateUser = (user, changes) => ({ ...user, ...changes });
const addItem = (list, item) => [...list, item];
const removeItem = (list, id) => list.filter((item) => item.id !== id);
```

These patterns make state changes predictable and easier to debug.
