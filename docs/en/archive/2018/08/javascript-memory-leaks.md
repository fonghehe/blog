---
title: "Debugging JavaScript Memory Leaks"
date: 2018-08-04 11:19:49
tags:
  - JavaScript
readingTime: 2
description: "After a page ran for a while, memory kept climbing and the browser eventually became slow and unresponsive. Here's a summary of common memory leak causes and de"
---

After a page ran for a while, memory kept climbing and the browser eventually became slow and unresponsive. Here's a summary of common memory leak causes and debugging approaches.

## Common Memory Leak Sources

### 1. Uncleared Event Listeners

```javascript
// Problem
class UserCard extends HTMLElement {
  connectedCallback() {
    document.addEventListener("click", this.handleClick);
    // Never removed — even after the element is destroyed, handleClick still holds a reference
  }

  handleClick = () => {
    /* ... */
  };
}

// Fix
class UserCard extends HTMLElement {
  connectedCallback() {
    document.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    // Remove listener when element is destroyed
    document.removeEventListener("click", this.handleClick);
  }
}
```

### 2. Uncleared Timers

```javascript
// Problem: timer holds reference to largeData
function startPolling() {
  const largeData = getLargeData();

  setInterval(() => {
    process(largeData); // largeData is captured in closure
  }, 1000);
  // Timer never cleared, largeData can never be GC'd
}

// Fix: save the timer ID and clear it at the appropriate time
class Poller {
  start() {
    this.timer = setInterval(() => this.poll(), 1000);
  }

  stop() {
    clearInterval(this.timer);
  }
}
```

### 3. Closures Holding Large Objects

```javascript
// Problem
function setup() {
  const largeArray = new Array(1000000).fill("data");

  return {
    getValue() {
      // This closure holds a reference to largeArray
      return largeArray[0];
    },
    // largeArray can never be freed while the returned object is alive
  };
}

// Fix: only save what you need
function setup() {
  const largeArray = new Array(1000000).fill("data");
  const firstValue = largeArray[0]; // only keep what's needed

  return {
    getValue() {
      return firstValue; // largeArray can now be GC'd
    },
  };
}
```

### 4. Unbounded Global Caches

```javascript
// Problem: cache grows without bound
const cache = {};

function processUser(userId) {
  if (!cache[userId]) {
    cache[userId] = fetchUser(userId); // grows indefinitely
  }
  return cache[userId];
}

// Fix: use WeakMap (GC-friendly)
const cache = new WeakMap();

function processUser(userObj) {
  if (!cache.has(userObj)) {
    cache.set(userObj, processData(userObj));
  }
  return cache.get(userObj);
  // When userObj is GC'd, the cache entry is automatically cleaned up
}

// Fix: LRU cache with size limit
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // move to end (most recently used)
    return value;
  }

  set(key, value) {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      // Delete the oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

## Debugging with Chrome DevTools

### Step 1: Memory Panel — Heap Snapshot

1. Open DevTools → Memory tab
2. Select "Heap snapshot" and click Take snapshot
3. Operate the page (simulate user behavior)
4. Take another snapshot
5. Switch to "Comparison" view to see which objects increased

### Step 2: Allocation Timeline

1. Select "Allocation instrumentation on timeline"
2. Operate the page
3. Look for bars that don't shrink (objects that weren't freed)

### Step 3: Use the Memory Panel's Retainer Tree

Find the object in the snapshot, expand the "Retainers" column to see which references are preventing garbage collection.

## Vue/React-Specific Leaks

```javascript
// Vue: not removing global event bus listeners in beforeDestroy
export default {
  mounted() {
    this.$bus.$on("data-update", this.handleUpdate);
  },
  beforeDestroy() {
    this.$bus.$off("data-update", this.handleUpdate); // must clean up!
  },
};

// React: not clearing timers in componentWillUnmount
class MyComponent extends React.Component {
  componentDidMount() {
    this.timer = setInterval(this.fetchData, 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer); // must clean up!
  }
}
```

## Summary

- Uncleared event listeners, timers, and closures are the most common leak sources
- Use `WeakMap`/`WeakSet` to hold DOM-related data so GC can reclaim it automatically
- Chrome DevTools Memory panel: heap snapshots + comparison to find leaked objects
- In Vue/React, clean up listeners and timers in the lifecycle's destroy hook
