---
title: "Promise Chaining and Error Handling"
date: 2018-04-24 15:30:06
tags:
  - JavaScript
readingTime: 1
description: "I covered Promise basics earlier. This time, let's focus specifically on chaining and error handling — areas with plenty of subtle pitfalls."
wordCount: 103
---

I covered Promise basics earlier. This time, let's focus specifically on chaining and error handling — areas with plenty of subtle pitfalls.

## Chaining Basics

```javascript
// then returns a new Promise, enabling chaining
fetchUser(1)
  .then((user) => fetchOrders(user.id)) // returns a new Promise
  .then((orders) => fetchDetails(orders)) // chain continues
  .then((details) => {
    console.log(details);
  })
  .catch((err) => {
    console.error("Any error in the chain ends up here", err);
  });
```

Key point: whatever `then`'s callback returns, the next `then` receives it.

```javascript
Promise.resolve(1)
  .then((v) => v + 1) // returns plain value 2
  .then((v) => v * 2) // returns plain value 4
  .then((v) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(v + 10), 1000);
    });
  }) // returns a Promise — waits for it to resolve
  .then((v) => console.log(v)); // 14 (after 1 second)
```

## Error Handling Approaches

```javascript
// Approach 1: .catch at the end of the chain (recommended)
fetchUser(1)
  .then(processUser)
  .then(saveUser)
  .catch((err) => {
    // Any rejection anywhere in the chain jumps here
    console.error(err);
  });

// Approach 2: second argument of each then (not recommended — easy to miss)
fetchUser(1)
  .then(processUser, (err) => console.error("fetchUser failed"))
  .then(saveUser, (err) => console.error("processUser failed"));

// Approach 3: async/await + try/catch (clearest)
async function handleUser() {
  try {
    const user = await fetchUser(1);
    const processed = await processUser(user);
    await saveUser(processed);
  } catch (err) {
    console.error(err);
  }
}
```

## Common Pitfalls

**Pitfall 1: The chain continues after catch**

```javascript
fetchUser(1)
  .catch((err) => {
    console.error(err);
    // No return → subsequent then receives undefined
    // With return → subsequent then receives the returned value
    // With throw → subsequent then is skipped, next catch handles it
  })
  .then((result) => {
    // Even if there was an error above, this still executes!
    console.log(result); // undefined (because catch had no return)
  });
```

**Pitfall 2: Forgetting to return**

```javascript
// Wrong: missing return — next step receives undefined
fetchUser(1)
  .then((user) => {
    fetchOrders(user.id); // no return!
  })
  .then((orders) => {
    console.log(orders); // undefined
  });

// Correct
fetchUser(1)
  .then((user) => {
    return fetchOrders(user.id); // return is crucial
  })
  .then((orders) => {
    console.log(orders); // correct orders data
  });
```

**Pitfall 3: Synchronous errors inside the Promise constructor**

```javascript
const p = new Promise((resolve, reject) => {
  throw new Error("sync error"); // this is caught by Promise, becomes a rejection
});

p.catch((err) => console.error(err)); // 'sync error'
```

## Concurrency Control

```javascript
// All concurrent, wait for all to complete
const [users, orders, products] = await Promise.all([
  fetchUsers(),
  fetchOrders(),
  fetchProducts(),
]);

// Race — whichever resolves first
const result = await Promise.race([
  fetchWithTimeout(5000),
  new Promise((_, reject) => setTimeout(() => reject("timeout"), 5000)),
]);

// All complete, regardless of success or failure (ES2020)
const results = await Promise.allSettled([
  fetchUsers(),
  fetchOrders(), // even if this fails, it doesn't affect the overall result
]);
```

## Summary

- `then` can return a value or a Promise, chaining them together
- `catch` at the end of the chain catches any error from above
- Common pitfalls: forgetting `return`, chain continuing after `catch`
- Concurrency: `Promise.all` (all must succeed), `Promise.allSettled` (regardless of outcome)
