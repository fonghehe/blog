---
title: "Promise Chains and Error Handling Done Right"
date: 2018-02-24 10:00:11
tags:
  - JavaScript
readingTime: 2
description: "Everyone uses Promises, but error handling is frequently wrong. Here are the common pitfalls and correct patterns."
wordCount: 169
---

Everyone uses Promises, but error handling is frequently wrong. Here are the common pitfalls and correct patterns.

## Basics: then/catch Chain

```javascript
fetchUser(userId)
  .then((user) => fetchProfile(user.id))
  .then((profile) => renderProfile(profile))
  .catch((error) => {
    console.error("Error:", error);
    showError(error.message);
  });
```

In a chain, any step that throws an error skips all subsequent `then` calls and goes directly to `catch`.

## Pitfall 1: Forgetting to return

```javascript
// ❌ Wrong: forgot return, fetchProfile result is lost
fetchUser(userId)
  .then((user) => {
    fetchProfile(user.id); // No return!
  })
  .then((profile) => {
    console.log(profile); // profile is undefined
  });

// ✅ Correct
fetchUser(userId)
  .then((user) => {
    return fetchProfile(user.id); // or arrow shorthand: user => fetchProfile(user.id)
  })
  .then((profile) => {
    console.log(profile);
  });
```

## Pitfall 2: Errors Swallowed Inside then

```javascript
// ❌ This catch won't catch errors from the then
fetchUser()
  .catch((error) => console.error(error)) // catch is before then, can't catch errors after it
  .then((user) => {
    throw new Error("This error will not be caught");
  });

// ✅ Put catch at the end of the chain
fetchUser()
  .then((user) => {
    throw new Error("This error will be caught");
  })
  .catch((error) => console.error(error));
```

## Pitfall 3: Async Errors Inside catch

```javascript
// ❌ Async errors inside catch are not caught
fetchUser().catch((error) => {
  setTimeout(() => {
    throw new Error("Error inside setTimeout is not part of the Promise chain");
  }, 100);
});

// ✅ Return a Promise chain instead
fetchUser().catch((error) => {
  return someAsyncFallback(); // return a Promise
});
```

## then's Second Argument vs catch

```javascript
// Option 1: second argument of then (only catches fetchUser errors)
fetchUser().then(
  (user) => processUser(user),
  (error) => handleFetchError(error), // only handles fetchUser errors
);

// Option 2: standalone catch (catches errors from the entire chain)
fetchUser()
  .then((user) => processUser(user))
  .catch((error) => handleError(error)); // catches both fetchUser and processUser errors
```

In most cases, `.catch()` is clearer.

## Promise.all: Parallel Requests

```javascript
// Fire multiple requests at once, continue when all complete
const [user, settings] = await Promise.all([
  fetchUser(userId),
  fetchSettings(userId),
]);

// Note: if any one fails, Promise.all rejects
// For error tolerance, use Promise.allSettled (ES2020)
const results = await Promise.allSettled([
  fetchUser(userId),
  fetchSettings(userId),
]);

results.forEach((result) => {
  if (result.status === "fulfilled") {
    console.log(result.value);
  } else {
    console.error(result.reason);
  }
});
```

## Error Handling with async/await

async/await is syntactic sugar over Promises; use try/catch for error handling:

```javascript
async function loadUserPage(userId) {
  try {
    const user = await fetchUser(userId);
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchUser or fetchProfile failures both land here
    handleError(error);
  }
}
```

### More Granular Error Handling

Sometimes you need to handle errors from different steps separately:

```javascript
async function loadUserPage(userId) {
  let user;
  try {
    user = await fetchUser(userId);
  } catch (error) {
    // Only handle fetchUser errors
    redirectToLogin();
    return;
  }

  try {
    const profile = await fetchProfile(user.id);
    renderPage(user, profile);
  } catch (error) {
    // fetchProfile failure fallback
    renderPage(user, null); // can render without profile
  }
}
```

### Utility: Wrapping try/catch

```javascript
// Go-style error handling
async function to(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

// Usage
async function loadData() {
  const [err, user] = await to(fetchUser(userId));
  if (err) {
    handleError(err);
    return;
  }
  console.log(user);
}
```

## Unhandled Promise Rejections

Both Node.js and browsers warn about unhandled Promise rejections:

```javascript
// Browser
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled Promise error:", event.reason);
  event.preventDefault(); // suppress console output (optional)
});

// Node.js
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise error:", reason);
});
```

## Summary

- Remember to `return` in every `then` in a chain
- Put `.catch()` at the end of the chain to catch all errors
- Use `Promise.all` for parallel requests; use `Promise.allSettled` when you need error tolerance
- Use try/catch with `async/await`; write separate try/catch blocks for granular handling
- Listen to `unhandledrejection` to prevent errors from being silently swallowed
