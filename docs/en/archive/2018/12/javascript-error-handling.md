---
title: "JavaScript Error Handling Best Practices"
date: 2018-12-08 11:24:51
tags:
  - JavaScript
readingTime: 2
description: "The most painful part of a production bug isn't the bug itself — it's not knowing where it is. Good error handling makes problems far easier to locate."
wordCount: 95
---

The most painful part of a production bug isn't the bug itself — it's not knowing where it is. Good error handling makes problems far easier to locate.

## Synchronous Errors: try/catch

```javascript
// Basic usage
try {
  JSON.parse("invalid json");
} catch (e) {
  console.error("JSON parse failed:", e.message);
}

// finally: runs whether it succeeds or fails
function readFile() {
  let file = null;
  try {
    file = openFile("data.json");
    return parseContent(file);
  } catch (e) {
    console.error("Read failed:", e);
    throw e; // Re-throw so the caller knows it failed
  } finally {
    if (file) file.close(); // Ensure resource is released
  }
}
```

## Async Error Handling

```javascript
// Promise: catch with .catch()
fetchUser(id)
  .then((user) => renderUser(user))
  .catch((e) => {
    console.error("Failed to fetch user:", e);
    showErrorMessage("Load failed, please try again");
  });

// async/await: catch with try/catch
async function loadUser(id) {
  try {
    const user = await fetchUser(id);
    return user;
  } catch (e) {
    if (e.status === 404) {
      return null; // User not found — return null rather than throwing
    }
    throw e; // Other errors propagate upward
  }
}
```

## Custom Error Classes

```javascript
// Distinguish between different error types
class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

// Usage
async function createUser(data) {
  if (!data.email) {
    throw new ValidationError("Email is required", "email");
  }

  const res = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new ApiError(body.message, res.status, body.code);
  }

  return res.json();
}

// Callers can handle different error types precisely
try {
  await createUser({ name: "Alice" });
} catch (e) {
  if (e instanceof ValidationError) {
    formErrors[e.field] = e.message; // Show field-level error
  } else if (e instanceof ApiError) {
    message.error(e.message); // Show API error message
  } else {
    message.error("Unknown error, please refresh the page");
    Sentry.captureException(e); // Report unknown errors
  }
}
```

## Global Error Capture

```javascript
// Catch unhandled Promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled Promise rejection:", event.reason);
  Sentry.captureException(event.reason);
  event.preventDefault(); // Suppress the default console warning
});

// Catch synchronous runtime errors
window.addEventListener("error", (event) => {
  if (event.error) {
    Sentry.captureException(event.error);
  }
});
```

## Vue Error Handling

```javascript
// main.js
Vue.config.errorHandler = (err, vm, info) => {
  // All component errors are captured here in production
  console.error("Vue component error:", err, info);
  Sentry.captureException(err, {
    extra: { componentInfo: info },
  });
};

// Component level: errorCaptured hook
export default {
  errorCaptured(err, vm, info) {
    // Captures errors from child components
    this.error = err.message;
    return false; // Prevent error from propagating further up
  },
};
```

## Error Boundary Component

```javascript
// Wraps error-prone areas; falls back gracefully on error
Vue.component("ErrorBoundary", {
  data() {
    return { error: null };
  },
  errorCaptured(err) {
    this.error = err;
    return false;
  },
  render(h) {
    if (this.error) {
      return h("div", { class: "error-fallback" }, [
        h("p", "Failed to load"),
        h(
          "button",
          {
            on: {
              click: () => {
                this.error = null;
              },
            },
          },
          "Retry",
        ),
      ]);
    }
    return this.$slots.default[0];
  },
});
```

## Summary

- Handle different error types differently — don't just `console.error` everything
- Custom error classes let callers handle specific situations precisely
- `unhandledrejection` catches Promises that are missing a `.catch()`
- Vue's `errorHandler` captures all errors in the component tree
- Integrate Sentry or a similar tool in production to make errors visible
