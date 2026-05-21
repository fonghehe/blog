---
title: "Advanced JavaScript Promise Patterns"
date: 2019-07-22 16:18:40
tags:
  - JavaScript
readingTime: 2
description: "Most developers are comfortable with the basics of `Promise` (`.then`, `.catch`, `.finally`), but real-world projects often require advanced patterns: concurren"
wordCount: 186
---

Most developers are comfortable with the basics of `Promise` (`.then`, `.catch`, `.finally`), but real-world projects often require advanced patterns: concurrency control, timeout handling, sequential execution, and waiting for all promises regardless of success or failure. This article covers the advanced Promise patterns I've accumulated in production projects.

## Promise.all vs Promise.race

A quick recap of these two fundamental APIs:

```javascript
// Promise.all: succeeds only if all succeed; fails if any one fails
const results = await Promise.all([
  fetch("/api/users"),
  fetch("/api/orders"),
  fetch("/api/products"),
]);
// results is an array of three responses

// Promise.race: takes the first completed result (success or failure)
const result = await Promise.race([
  fetch("/api/data"),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 5000),
  ),
]);
```

## Practice 1: Request Timeout with Promise.race

```javascript
function fetchWithTimeout(url, options = {}, timeout = 5000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out: ${url} (${timeout}ms)`));
      }, timeout);
    }),
  ]);
}

try {
  const response = await fetchWithTimeout("/api/slow-endpoint", {}, 3000);
  const data = await response.json();
} catch (err) {
  console.error(err.message); // "Request timed out: /api/slow-endpoint (3000ms)"
}
```

A better approach with `AbortController` to actually cancel the request:

```javascript
function fetchWithAbort(url, options = {}, timeout = 5000) {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { ...options, signal })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Request timed out: ${url}`);
      }
      throw err;
    });
}
```

## Practice 2: Promise.allSettled (TC39 Stage 3 in 2019)

`Promise.all` fails immediately if any promise fails. `Promise.allSettled` waits for all promises (regardless of success or failure) and returns the status and result of each:

```javascript
// Polyfill (no native support in 2019)
if (!Promise.allSettled) {
  Promise.allSettled = function (promises) {
    return Promise.all(
      promises.map((p) =>
        Promise.resolve(p).then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason }),
        ),
      ),
    );
  };
}

const results = await Promise.allSettled([
  fetch("/api/users").then((r) => r.json()),
  fetch("/api/orders").then((r) => r.json()),
  fetch("/api/products").then((r) => r.json()),
]);

// Separate successes and failures
const successes = results
  .filter((r) => r.status === "fulfilled")
  .map((r) => r.value);

const failures = results
  .filter((r) => r.status === "rejected")
  .map((r) => r.reason);
```

Real-world use case: batch delete users where some may fail due to insufficient permissions:

```javascript
async function batchDeleteUsers(userIds) {
  const results = await Promise.allSettled(userIds.map((id) => deleteUser(id)));

  const deleted = [];
  const failed = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      deleted.push(userIds[index]);
    } else {
      failed.push({ id: userIds[index], error: result.reason.message });
    }
  });

  return { deleted, failed };
}
```

## Practice 3: Concurrency Control

Sending 100 requests simultaneously will overwhelm the server. Control concurrency:

```javascript
class ConcurrencyPool {
  constructor(concurrency = 6) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._run();
    });
  }

  _run() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._run();
        });
    }
  }
}

const pool = new ConcurrencyPool(3); // max 3 concurrent requests
const urls = Array.from({ length: 20 }, (_, i) => `/api/item/${i}`);

const results = await Promise.all(
  urls.map((url) => pool.add(() => fetch(url).then((r) => r.json()))),
);
```

## Practice 4: Sequential Execution

Execute promises one by one in order:

```javascript
async function sequential(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

// Using reduce
function sequentialReduce(tasks) {
  return tasks.reduce(
    (chain, task) =>
      chain.then((results) => task().then((result) => [...results, result])),
    Promise.resolve([]),
  );
}
```

## Summary

- `Promise.race` is great for implementing request timeouts
- `Promise.allSettled` (polyfill needed in 2019) handles partial failures gracefully
- Concurrency control prevents server overload when making many parallel requests
- Sequential execution is needed when order matters or requests depend on each other
