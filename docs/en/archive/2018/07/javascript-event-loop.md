---
title: "Deep Dive into the JavaScript Event Loop"
date: 2018-07-07 10:43:20
tags:
  - JavaScript
readingTime: 1
description: "The Event Loop is the core of JavaScript's concurrency model and a frequent interview topic."
---

The Event Loop is the core of JavaScript's concurrency model and a frequent interview topic.

## Single-threaded and Non-blocking

JavaScript is single-threaded — only one piece of code executes at a time. But through the Event Loop, it can handle async operations without blocking the main thread.

## Call Stack and Task Queues

```
┌────────────────────────────────────┐
│            Call Stack              │  ← executes synchronous code
├────────────────────────────────────┤
│       Web APIs (browser-provided)  │  ← setTimeout, fetch, DOM events
├────────────────────────────────────┤
│   Macrotask Queue                  │  ← setTimeout, setInterval, I/O
├────────────────────────────────────┤
│   Microtask Queue                  │  ← Promise.then, MutationObserver
└────────────────────────────────────┘
```

## Execution Order

1. Execute all synchronous code in the current call stack
2. Drain the microtask queue (execute all of them)
3. Execute one macrotask
4. Go back to step 2

```javascript
console.log("1"); // synchronous

setTimeout(() => console.log("2"), 0); // macrotask

Promise.resolve()
  .then(() => console.log("3")) // microtask
  .then(() => console.log("4")); // microtask

console.log("5"); // synchronous

// Output: 1 5 3 4 2
```

Analysis:

1. Sync: print 1, 5
2. Microtasks: print 3 (first then), then 4 (second then)
3. Macrotask: print 2

## The Nature of async/await

```javascript
async function foo() {
  console.log("A");
  await bar();
  console.log("C"); // code after await is a .then callback (microtask)
}

function bar() {
  return Promise.resolve();
}

foo();
console.log("B");

// Output: A B C
```

`await` pauses function execution and puts the remaining code into the microtask queue.

## Classic Interview Question

```javascript
async function async1() {
  console.log("async1 start");
  await async2();
  console.log("async1 end"); // microtask
}

async function async2() {
  console.log("async2");
}

console.log("start");
setTimeout(() => console.log("timeout"), 0);
async1();
new Promise((resolve) => {
  console.log("promise executor");
  resolve();
}).then(() => console.log("promise then"));

console.log("end");

// Output:
// start
// async1 start
// async2
// promise executor
// end
// async1 end    ← microtask
// promise then  ← microtask
// timeout       ← macrotask
```

## Differences in Node.js

Node.js has additional macrotask types: `setImmediate` (runs after I/O callbacks) and `process.nextTick` (higher priority than Promise microtasks).

```javascript
// In Node.js
process.nextTick(() => console.log("nextTick")); // first
Promise.resolve().then(() => console.log("promise")); // second
setImmediate(() => console.log("setImmediate")); // last

// nextTick → promise → setImmediate
```

## Summary

- JS is single-threaded; the Event Loop handles async operations
- Microtasks (Promise.then) take priority over macrotasks (setTimeout)
- After each macrotask, all microtasks are drained
- `async/await` is syntactic sugar for Promises; code after `await` is a microtask
