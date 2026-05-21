---
title: "A Deep Dive into JavaScript Closures"
date: 2018-05-10 10:41:26
tags:
  - JavaScript
readingTime: 2
description: "Closures are an obligatory interview topic, but truly understood by few. This article starts from lexical scope to explain what a closure is, and its practical "
wordCount: 187
---

Closures are an obligatory interview topic, but truly understood by few. This article starts from lexical scope to explain what a closure is, and its practical engineering uses.

## Lexical Scope: The Foundation of Closures

JavaScript uses **lexical scope** (also called static scope): **a function's scope is determined at definition time, not at call time**.

```javascript
const x = 10;

function outer() {
  const y = 20;

  function inner() {
    const z = 30;
    console.log(x, y, z); // 10, 20, 30
    // inner can access variables from outer and the global scope
    // This is determined by where the function is defined
  }

  inner();
}

outer();
```

## What Is a Closure

**Closure = function + its lexical environment at definition time**

When an inner function is referenced by the outside world, causing the outer function's variables to be kept from garbage collection, a closure is formed:

```javascript
function makeCounter() {
  let count = 0; // This variable is "closed over" in the closure

  return function () {
    count++;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3

// count is not destroyed because the counter function still references it
```

## The Classic Closure Trap

```javascript
// ❌ Classic problem: closures inside loops
for (var i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // Outputs 5 5 5 5 5 (not 0 1 2 3 4)
  }, i * 1000);
}

// Reason: var has no block scope — all callbacks share the same i
// By the time the loop ends, i = 5, so all callbacks print 5
```

**Solution 1: let (recommended)**

```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    console.log(i); // 0 1 2 3 4 (let creates a new binding each iteration)
  }, i * 1000);
}
```

**Solution 2: IIFE to create a new scope**

```javascript
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => {
      console.log(j); // 0 1 2 3 4
    }, j * 1000);
  })(i);
}
```

## Practical Use Cases

### Module Pattern (encapsulating private state)

```javascript
const bankAccount = (function () {
  let balance = 0; // private — not directly accessible from outside

  return {
    deposit(amount) {
      balance += amount;
      return balance;
    },
    withdraw(amount) {
      if (amount > balance) {
        throw new Error("Insufficient funds");
      }
      balance -= amount;
      return balance;
    },
    getBalance() {
      return balance;
    },
  };
})();

bankAccount.deposit(1000); // 1000
bankAccount.withdraw(200); // 800
bankAccount.getBalance(); // 800
// bankAccount.balance  → undefined (not directly accessible)
```

### Function Factory

```javascript
function multiply(multiplier) {
  return function (number) {
    return number * multiplier;
  };
}

const double = multiply(2);
const triple = multiply(3);

double(5); // 10
triple(5); // 15
```

### Memoization

```javascript
function memoize(fn) {
  const cache = new Map(); // cache stored in the closure

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const expensiveFn = memoize(function (n) {
  // Simulate a slow computation
  let result = 0;
  for (let i = 0; i < n * 1000000; i++) result += i;
  return result;
});

expensiveFn(100); // First call: slow
expensiveFn(100); // Second call: instant (cache hit)
```

## Closures and Memory Leaks

Closures prevent garbage collection; used carelessly they cause memory leaks:

```javascript
function attachHandler() {
  const largeData = new Array(1000000).fill("data");

  document.getElementById("btn").addEventListener("click", function () {
    // The callback holds a reference to largeData, preventing GC
    console.log(largeData.length);
  });
}
```

**Fix:** manually dereference or remove event listeners when done:

```javascript
// In a Vue component
mounted() {
  this.handler = () => { ... }
  element.addEventListener('click', this.handler)
},
beforeDestroy() {
  element.removeEventListener('click', this.handler)  // clean up
}
```

## Summary

- Closure = function + its lexical environment at definition time
- Use `let` in loops to avoid the classic closure trap
- Use closures for private state, function factories, and memoization
- Watch out for closures holding large data unnecessarily — they can cause memory leaks
