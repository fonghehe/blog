---
title: "Deep Dive into the Node.js Event Loop"
date: 2018-04-09 11:02:57
tags:
  - JavaScript
readingTime: 2
description: "A classic Node.js interview topic — but many people only memorize the conclusions without understanding the underlying mechanism. This article explains the even"
wordCount: 311
---

A classic Node.js interview topic — but many people only memorize the conclusions without understanding the underlying mechanism. This article explains the event loop through the actual execution order of real code.

## Why Node.js Is Single-Threaded but Non-Blocking

Node.js's main thread is single-threaded, but I/O operations (file reads, network requests) are delegated to the OS for asynchronous processing.

```
Main thread → initiates I/O request → continues executing subsequent code
                ↓ (delegated to the OS)
            OS completes I/O → puts callback into the event queue
                ↓
When main thread is idle → takes callbacks from queue and executes them
```

This is the fundamental idea behind the event loop.

## The Six Phases of the Event Loop

Node.js's event loop is implemented by libuv and consists of six phases:

```
   ┌───────────────────────────┐
┌─>│           timers          │  callbacks for setTimeout / setInterval
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  deferred I/O callbacks from the previous iteration
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │       idle, prepare       │  internal use only
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  retrieve new I/O events (main phase)
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           check           │  callbacks for setImmediate
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
└──┤      close callbacks      │  e.g. socket.on('close', ...)
   └───────────────────────────┘
```

## microtask vs macrotask

This is the most confusing part.

**macrotask (macro task):**

- `setTimeout`
- `setInterval`
- `setImmediate`
- I/O callbacks

**microtask (micro task):**

- `Promise.then/.catch/.finally`
- `process.nextTick` (highest priority microtask)
- `queueMicrotask`

**Execution rule: After each macro task completes, all microtasks are immediately drained, then the next macro task runs.**

## Classic Problem Walkthrough

```javascript
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
  .then(() => console.log("3"))
  .then(() => console.log("4"));

process.nextTick(() => console.log("5"));

console.log("6");
```

**Execution order: 1 6 5 3 4 2**

Analysis:

1. `1` — synchronous code
2. `setTimeout` goes to the macrotask queue
3. `Promise.then` goes to the microtask queue
4. `process.nextTick` goes to the nextTick queue (highest priority microtask)
5. `6` — synchronous code
6. **Drain microtasks**: nextTick first (`5`), then Promise.then (`3`, `4`)
7. **Next macrotask**: `setTimeout` (`2`)

## setImmediate vs setTimeout(fn, 0)

```javascript
setTimeout(() => console.log("setTimeout"), 0);
setImmediate(() => console.log("setImmediate"));
```

**The result is non-deterministic!** When executed in the main module, the order depends on system timer precision.

But **inside an I/O callback**, `setImmediate` **always runs before** `setTimeout`:

```javascript
const fs = require("fs");

fs.readFile("./file.txt", () => {
  setTimeout(() => console.log("setTimeout"), 0);
  setImmediate(() => console.log("setImmediate"));
});

// setImmediate always prints first
```

Reason: I/O callbacks run in the poll phase. After poll completes, the loop moves directly to the check phase (`setImmediate`) before looping back to the timers phase (`setTimeout`).

## The process.nextTick Pitfall

`process.nextTick` callbacks execute before each phase transition — the highest priority. Abusing it can starve I/O:

```javascript
// ❌ Recursive nextTick — I/O will never execute
function loopNextTick() {
  process.nextTick(loopNextTick);
}
loopNextTick();
```

## Practical Applications

```javascript
// Turn synchronous code into async (gives callers a chance to attach event listeners)
class EventEmitter {
  emit(event, data) {
    process.nextTick(() => {
      this.listeners[event]?.forEach((fn) => fn(data));
    });
  }
}

// Ensure async API consistency
function readData(callback) {
  if (this.cache) {
    process.nextTick(() => callback(null, this.cache)); // keep it async
    return;
  }
  fs.readFile("./data", callback);
}
```

## Summary

- The event loop is Node.js's core mechanism for handling concurrency
- Microtasks (Promise, nextTick) execute immediately after each macrotask
- `process.nextTick` has higher priority than `Promise.then`
- Inside I/O, `setImmediate` runs before `setTimeout`
- Avoid infinite recursion in nextTick/Promise — it blocks I/O
