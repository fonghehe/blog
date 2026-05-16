---
title: "Frontend Performance Optimization: JavaScript Execution"
date: 2018-12-15 10:33:56
tags:
  - Performance Optimization
readingTime: 2
description: "Last month I investigated a page jank issue and traced it to long JS execution times causing frame drops. This is a good opportunity to document common JS perfo"
---

Last month I investigated a page jank issue and traced it to long JS execution times causing frame drops. This is a good opportunity to document common JS performance optimization techniques.

## Browser Frame Rate

Smooth animations run at 60 fps — about 16.7 ms per frame.

```
One frame (16.7 ms) must accommodate:
- JS execution
- Style calculation
- Layout
- Paint
- Composite

If JS execution exceeds 16 ms, the frame is delayed and the user perceives jank
```

## Breaking Up Long Tasks

```javascript
// ❌ Processing 10,000 items blocks the main thread
function processLargeList(list) {
  list.forEach((item) => {
    // Expensive operation
    processItem(item);
  });
}

// ✅ Option 1: Process in batches
function processInBatches(list, batchSize = 100) {
  let index = 0;

  function processBatch() {
    const end = Math.min(index + batchSize, list.length);
    while (index < end) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      // After each batch, yield the main thread so the browser can handle user input
      requestAnimationFrame(processBatch);
    }
  }

  requestAnimationFrame(processBatch);
}

// ✅ Option 2: Use requestIdleCallback (process during browser idle time)
function processWhenIdle(list) {
  let index = 0;

  requestIdleCallback(function process(deadline) {
    // deadline.timeRemaining(): how much time is left in this frame
    while (deadline.timeRemaining() > 0 && index < list.length) {
      processItem(list[index++]);
    }

    if (index < list.length) {
      requestIdleCallback(process);
    }
  });
}
```

## Debounce and Throttle

```javascript
// Debounce: execute delay ms after triggering stops (search suggestions)
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Throttle: execute at most once per interval ms (scroll handling)
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// Real usage
const debouncedSearch = debounce(handleSearch, 300);
const throttledScroll = throttle(handleScroll, 100);

input.addEventListener("input", debouncedSearch);
window.addEventListener("scroll", throttledScroll);
```

## Avoid Frequent DOM Operations

```javascript
// ❌ Querying DOM and triggering layout in every loop iteration
for (let i = 0; i < 100; i++) {
  const height = element.offsetHeight; // Read forces synchronous layout
  element.style.top = height * i + "px"; // Write
}

// ✅ Separate reads and writes
const height = element.offsetHeight; // Read once
for (let i = 0; i < 100; i++) {
  elements[i].style.top = height * i + "px"; // Write only
}

// ✅ Use DocumentFragment for batch insertion
const fragment = document.createDocumentFragment();
for (let i = 0; i < 1000; i++) {
  const li = document.createElement("li");
  li.textContent = `Item ${i}`;
  fragment.appendChild(li); // No reflow triggered
}
ul.appendChild(fragment); // One insertion — one reflow
```

## Web Worker: Move Heavy Computation Off the Main Thread

```javascript
// worker.js
self.addEventListener("message", (e) => {
  const { data } = e;
  const result = heavyCompute(data); // Runs in worker thread
  self.postMessage(result);
});

// main.js
const worker = new Worker("/worker.js");

worker.postMessage(largeData);
worker.addEventListener("message", (e) => {
  displayResult(e.data); // Result is back — update the UI
});
```

## Memory and GC Pressure

```javascript
// ❌ Frequent object creation in hot paths increases GC pressure
function updateItems(items) {
  return items.map((item) => ({
    // New object every time
    ...item,
    display: formatDisplay(item),
  }));
}

// ✅ Reuse objects (on performance-critical paths)
function updateItems(items, result) {
  for (let i = 0; i < items.length; i++) {
    result[i] = result[i] || {}; // Reuse existing object
    Object.assign(result[i], items[i]);
    result[i].display = formatDisplay(items[i]);
  }
}
```

## Measuring with the Performance API

```javascript
performance.mark("start-heavy");
heavyOperation();
performance.mark("end-heavy");
performance.measure("heavy", "start-heavy", "end-heavy");

const [measure] = performance.getEntriesByName("heavy");
console.log(`Time: ${measure.duration.toFixed(2)}ms`);
```

## Summary

- Break long tasks into batches (`requestAnimationFrame` or `requestIdleCallback`)
- Throttle scroll/resize events; debounce input search
- Batch DOM reads and writes to avoid forced synchronous layout
- Move heavy computation to a Web Worker off the main thread
- Use `performance.mark/measure` to precisely measure critical path timing
