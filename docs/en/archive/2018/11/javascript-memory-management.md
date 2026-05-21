---
title: "JavaScript Memory Management and Garbage Collection"
date: 2018-11-10 14:30:38
tags:
  - JavaScript
readingTime: 2
description: "Frontend pages that get slower over time usually have a memory leak. Understanding JavaScript's memory management helps you write code that doesn't leak."
wordCount: 191
---

Frontend pages that get slower over time usually have a memory leak. Understanding JavaScript's memory management helps you write code that doesn't leak.

## Memory Lifecycle

```
1. Allocation: the JS engine allocates memory when variables are declared or objects are created
2. Usage: reading and writing the allocated memory
3. Release: memory no longer in use should be reclaimed
```

JavaScript uses a garbage collector (GC) to reclaim memory automatically — no manual `free()` required.

## Garbage Collection: Mark-and-Sweep

Modern JS engines primarily use the **mark-and-sweep** algorithm:

```
Starting from the "roots" (global object, current call stack), traverse all reachable objects and mark them.
Unmarked objects (unreachable) are garbage — their memory is freed.
```

```javascript
function foo() {
  const obj = { name: "Alice" }; // memory allocated
  console.log(obj.name);
  // After foo returns, obj is unreachable — it will be collected by GC
}

// Memory leak: obj accidentally stays reachable
const cache = {};
function foo() {
  const obj = { name: "Alice", bigData: new Array(100000) };
  cache[obj.name] = obj; // obj is referenced by cache — GC can't collect it!
}
```

## Common Memory Leak Scenarios

**1. Global variables**

```javascript
// ❌ Accidentally creating a global variable
function foo() {
  leak = { data: new Array(100000) }; // no var/let/const — becomes a global
}

// ✅ Strict mode prevents this
("use strict");
function foo() {
  leak = {}; // TypeError: leak is not defined
}
```

**2. Uncleaned timers**

```javascript
// ❌ Timer keeps running after component is destroyed, holding a reference to the component
created() {
  this.timer = setInterval(() => {
    this.data = fetchData()  // holds `this` (the component instance)
  }, 1000)
}

// ✅ Clean up when the component is destroyed
beforeDestroy() {
  clearInterval(this.timer)
}
```

**3. Unremoved event listeners**

```javascript
// ❌
mounted() {
  window.addEventListener('resize', this.handleResize)
  // After component is destroyed, window still holds a reference to handleResize
}

// ✅
beforeDestroy() {
  window.removeEventListener('resize', this.handleResize)
}
```

**4. Uncleaned Vue event bus listeners**

```javascript
// ❌
mounted() {
  this.$bus.$on('update', this.handler)
}

// ✅
beforeDestroy() {
  this.$bus.$off('update', this.handler)
}
```

**5. Closures holding large objects**

```javascript
// ❌
function attachEvent(element) {
  const bigData = new Array(100000).fill("data");
  element.addEventListener("click", function () {
    console.log("clicked"); // closure holds bigData — bigData can't be collected
  });
}

// ✅ Don't hold large objects in closures
function attachEvent(element) {
  element.addEventListener("click", function () {
    console.log("clicked"); // only holds what you actually need
  });
}
```

## Finding Memory Leaks with Chrome DevTools

1. **Performance panel**: record a session and check whether the memory line chart keeps climbing
2. **Memory panel → Heap snapshot**:
   - Take a snapshot before the operation
   - Perform the suspicious operation (e.g., open and close a modal)
   - Take a second snapshot after the operation
   - Compare the two snapshots — look for objects that are increasing

```
If the modal component still appears in the snapshot after closing,
a reference has not been released.
```

## Weak References: WeakMap and WeakSet

```javascript
// WeakMap: keys are weak references — entries are automatically deleted when the key is GC'd
const cache = new WeakMap();

function processUser(user) {
  if (cache.has(user)) return cache.get(user);

  const result = heavyCompute(user);
  cache.set(user, result); // when user is GC'd, this entry disappears automatically
  return result;
}
// No manual cache cleanup needed — no memory leak
```

## Summary

- JavaScript uses mark-and-sweep GC — "unreachable" objects are collected automatically
- Memory leak = objects no longer in use accidentally remaining reachable
- Common causes: uncleaned timers, event listeners, closures, global variables
- Vue components should clean up timers and event listeners in `beforeDestroy`
- `WeakMap`/`WeakSet` enable caching that doesn't prevent GC
