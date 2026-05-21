---
title: "Debounce and Throttle: Principles, Implementations, and Use Cases"
date: 2018-04-17 16:15:36
tags:
  - Frontend
readingTime: 3
description: "Debounce and throttle are fundamental frontend optimization tools used in almost every project — and a must-know for interviews. This article explains the diffe"
wordCount: 373
---

Debounce and throttle are fundamental frontend optimization tools used in almost every project — and a must-know for interviews. This article explains the differences and when to use each.

## The Problem

Some events fire at extremely high frequencies:

- `scroll`: may fire dozens of times per scroll
- `resize`: fires continuously as the window resizes
- `input`: fires once per keystroke
- `mousemove`: fires every frame as the mouse moves

If the callback executes on every event (especially network requests or DOM operations), performance degrades.

## Throttle

**Definition**: No matter how many times the event fires within a given interval, the callback executes only once.

**Analogy**: A flow-restricted faucet — at most one drip per minute, no matter how much you open the tap.

```javascript
function throttle(fn, delay) {
  let lastTime = 0;

  return function (...args) {
    const now = Date.now();

    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

// Usage: scroll event fires at most once every 200ms
window.addEventListener(
  "scroll",
  throttle(() => {
    console.log("scroll position:", window.scrollY);
  }, 200),
);
```

The **timestamp version** executes at the start of each interval (without waiting for the last trigger).

**Timer version** (executes at the end of the interval):

```javascript
function throttle(fn, delay) {
  let timer = null;

  return function (...args) {
    if (timer) return; // still waiting, ignore

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}
```

**Use cases:**

- Scroll-to-load (check every 300ms if the bottom has been reached)
- Prevent duplicate button clicks (trigger only once in 3 seconds)
- Mouse-follow animations
- API polling frequency control

## Debounce

**Definition**: After the event stops firing, wait a specified time before executing the callback. If the event fires again during the wait, the timer resets.

**Analogy**: Elevator doors — if someone enters, the timer resets; the doors close only after no one has entered for a while.

```javascript
function debounce(fn, delay) {
  let timer = null;

  return function (...args) {
    // Clear the previous timer
    if (timer) clearTimeout(timer);

    // Reset the timer
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// Usage: search only after the user stops typing for 500ms
const searchInput = document.getElementById("search");
searchInput.addEventListener(
  "input",
  debounce((e) => {
    fetchSearchResults(e.target.value);
  }, 500),
);
```

**Immediate execution version** (executes on the first trigger, then cools down):

```javascript
function debounce(fn, delay, immediate = false) {
  let timer = null;

  return function (...args) {
    const callNow = immediate && !timer;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);

    if (callNow) fn.apply(this, args);
  };
}
```

**Use cases:**

- Real-time search (request only after typing stops)
- Form validation (validate only after typing stops)
- Recalculate layout after window resize ends
- Auto-save after editor content changes

## Comparison

|                  | Throttle                   | Debounce                        |
| ---------------- | -------------------------- | ------------------------------- |
| When it executes | At fixed intervals         | After the event stops           |
| Best for         | Continuous response needed | Waiting for an action to finish |
| Example          | Scroll position updates    | Search box autocomplete         |

**Core difference**: Throttle cares about execution **frequency**; debounce cares about whether an **action is complete**.

## Using in Vue

```vue
<script>
import { debounce, throttle } from "lodash";

export default {
  data() {
    return { searchQuery: "" };
  },
  created() {
    // Create in 'created' so each component instance has its own debounce function
    this.debouncedSearch = debounce(this.fetchResults, 500);
  },
  beforeDestroy() {
    // Cancel any pending calls when the component is destroyed
    this.debouncedSearch.cancel();
  },
  methods: {
    onInput(value) {
      this.searchQuery = value;
      this.debouncedSearch(value);
    },
    async fetchResults(query) {
      const results = await searchAPI(query);
      this.results = results;
    },
  },
};
</script>
```

**Note**: Don't wrap with `debounce()` directly inside `methods` — that causes all component instances to share the same debounce function:

```javascript
// ❌ Wrong: functions in methods are shared across instances
methods: {
  onInput: debounce(function(value) { ... }, 500)
}

// ✅ Correct: create in 'created', each instance is independent
created() {
  this.debouncedFn = debounce(this.fn, 500)
}
```

## Summary

- High-frequency events must be throttled or debounced, or you'll have performance issues
- Throttle = execute at a fixed rate (for scenarios requiring continuous response)
- Debounce = execute after stopping (for scenarios waiting for an action to complete)
- In Vue: create in `created`, cancel in `beforeDestroy`
