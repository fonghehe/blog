---
title: "Node.js Middleware Pattern Explained"
date: 2019-07-24 11:19:10
tags:
  - JavaScript
readingTime: 2
description: "The middleware pattern is a fundamental design pattern in Node.js, best exemplified by Express.js. It allows you to compose request/response processing through "
---

The middleware pattern is a fundamental design pattern in Node.js, best exemplified by Express.js. It allows you to compose request/response processing through a chain of functions. This article explores its core principles and practical applications.

## What is Middleware?

Middleware functions have access to the request object (`req`), the response object (`res`), and the `next` function in the request-response cycle:

```javascript
function middleware(req, res, next) {
  // Do something with req/res
  next(); // Pass control to the next middleware
}
```

## Building a Simple Middleware System

```javascript
class App {
  constructor() {
    this.middlewares = [];
  }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  run(req, res) {
    const dispatch = (index) => {
      if (index >= this.middlewares.length) return;
      const fn = this.middlewares[index];
      fn(req, res, () => dispatch(index + 1));
    };
    dispatch(0);
  }
}

const app = new App();

app.use((req, res, next) => {
  console.log("Logging:", req.method, req.url);
  next();
});

app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
  // Note: code after next() runs after all downstream middleware
});

app.use((req, res) => {
  res.end("Hello World");
});
```

## Koa-style Async Middleware

Koa uses an "onion model" — middleware can `await next()` and resume execution after all downstream middleware completes:

```javascript
function compose(middlewares) {
  return function (ctx) {
    let index = -1;

    function dispatch(i) {
      if (i <= index)
        return Promise.reject(new Error("next() called multiple times"));
      index = i;

      if (i >= middlewares.length) return Promise.resolve();

      const fn = middlewares[i];
      return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
    }

    return dispatch(0);
  };
}

// Usage
const middlewares = [
  async (ctx, next) => {
    console.log("middleware 1 start");
    await next();
    console.log("middleware 1 end");
  },
  async (ctx, next) => {
    console.log("middleware 2 start");
    await next();
    console.log("middleware 2 end");
  },
  async (ctx) => {
    console.log("middleware 3 (final)");
  },
];

// Output:
// middleware 1 start
// middleware 2 start
// middleware 3 (final)
// middleware 2 end
// middleware 1 end
```

## Common Middleware Patterns

### Logging Middleware

```javascript
function logger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`,
    );
  });
  next();
}
```

### Authentication Middleware

```javascript
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
```

### Error Handling Middleware

```javascript
// Express error middleware takes 4 arguments
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Server Error" : err.message,
  });
}

app.use(errorHandler); // Must be registered last
```

### Rate Limiting Middleware

```javascript
function rateLimit(maxRequests, windowMs) {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (requests.has(ip)) {
      const times = requests.get(ip).filter((t) => t > windowStart);
      requests.set(ip, times);
    }

    const times = requests.get(ip) || [];
    if (times.length >= maxRequests) {
      return res.status(429).json({ error: "Too Many Requests" });
    }

    times.push(now);
    requests.set(ip, times);
    next();
  };
}

app.use(rateLimit(100, 60 * 1000)); // 100 requests per minute
```

## Summary

- Middleware is a function chain where each function can process request/response and optionally call `next()`
- Express uses a linear model; Koa uses the onion model (code before/after `next()` both run)
- Common patterns: logging, authentication, error handling, rate limiting
- The order of middleware registration matters — they execute in registration order
