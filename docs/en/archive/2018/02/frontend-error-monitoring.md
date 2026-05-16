---
title: "Frontend Error Monitoring: From window.onerror to Sentry"
date: 2018-02-22 16:21:00
tags:
  - Performance Optimization
readingTime: 2
description: "Production bugs are silent without monitoring — users just leave. Setting up error monitoring is one of the highest ROI investments for frontend projects."
---

Production bugs are silent without monitoring — users just leave. Setting up error monitoring is one of the highest ROI investments for frontend projects.

## Why You Need Error Monitoring

- Browser environments vary wildly (OS, browser version, extensions, network)
- You can't reproduce all user environments locally
- Users rarely report bugs — they just stop using your app
- Source maps let you see the actual code, not minified gibberish

## window.onerror: The Foundation

```javascript
window.onerror = function (message, source, lineno, colno, error) {
  // message: error message
  // source: script URL where error occurred
  // lineno, colno: line and column number
  // error: Error object (with .stack property)

  console.error("Uncaught error:", { message, source, lineno, colno });

  // Report to server
  fetch("/api/errors", {
    method: "POST",
    body: JSON.stringify({
      message,
      stack: error?.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    }),
  });

  return false; // don't suppress default browser error handling
};
```

## Handling Unhandled Promise Rejections

`window.onerror` doesn't catch Promise rejections:

```javascript
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  reportError({
    message: reason?.message || String(reason),
    stack: reason?.stack,
    type: "unhandledrejection",
  });
});
```

## Cross-Origin Scripts

If your JS files are on a CDN (different origin), `window.onerror` receives `"Script error."` with no useful information due to browser security policies.

Fix: add `crossorigin="anonymous"` on the script tag AND set the appropriate CORS header on the CDN:

```html
<script src="https://cdn.example.com/app.js" crossorigin="anonymous"></script>
```

```
// CDN response header
Access-Control-Allow-Origin: *
```

## Source Maps

Minified code errors are useless. Source maps map minified positions back to original source:

```javascript
// webpack.config.js
module.exports = {
  devtool: "hidden-source-map", // generate .map files, but don't link them in JS
};
```

**Important**: Don't expose source maps publicly (they reveal your source code). Upload them to your error reporting service, don't serve them to browsers.

## Sentry Integration

Manual reporting gets complex fast. Sentry handles it all automatically:

```bash
npm install @sentry/vue @sentry/tracing
```

```javascript
// main.js
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";

Sentry.init({
  app,
  dsn: "https://your-dsn@sentry.io/project-id",
  integrations: [
    new BrowserTracing({
      routingInstrumentation: Sentry.vueRouterInstrumentation(router),
    }),
  ],
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  environment: process.env.NODE_ENV,
  release: process.env.VUE_APP_VERSION,
});
```

Sentry automatically:

- Captures uncaught errors and unhandled rejections
- Links source maps for readable stack traces
- Groups duplicate errors
- Tracks affected users per error
- Sends alerts on new issues

## Report Errors Manually

```javascript
// Capture a handled exception with context
try {
  const result = parseWeirdData(input);
} catch (err) {
  Sentry.captureException(err, {
    extra: { input, userId: currentUser.id },
    tags: { feature: "data-import" },
  });
}

// Add user context for all subsequent errors
Sentry.setUser({ id: user.id, email: user.email });
```
