---
title: "Frontend Monitoring: Error Capture and Performance Reporting"
date: 2019-05-18 10:33:34
tags:
  - Performance Optimization
readingTime: 1
description: "After a project goes live, problems are usually discovered by users first, then reported to operations, and finally reach development. Building a monitoring sys"
wordCount: 68
---

After a project goes live, problems are usually discovered by users first, then reported to operations, and finally reach development. Building a monitoring system lets us find problems before users do.

## Error Monitoring

### Global Error Capture

```javascript
// Uncaught JS errors
window.addEventListener(
  "error",
  (event) => {
    const { message, filename, lineno, colno, error } = event;

    report({
      type: "js_error",
      message,
      stack: error?.stack,
      filename,
      position: `${lineno}:${colno}`,
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    });
  },
  true,
);

// Unhandled Promise rejections
window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  report({
    type: "promise_error",
    message: reason?.message || String(reason),
    stack: reason?.stack,
    url: location.href,
    timestamp: Date.now(),
  });
});

// Resource load failures (images, CSS, JS)
window.addEventListener(
  "error",
  (event) => {
    const target = event.target;
    if (target !== window) {
      report({
        type: "resource_error",
        tagName: target.tagName,
        src: target.src || target.href,
        url: location.href,
        timestamp: Date.now(),
      });
    }
  },
  true,
);
```

### Vue Error Capture

```javascript
// Vue 2
Vue.config.errorHandler = (error, vm, info) => {
  report({
    type: "vue_error",
    message: error.message,
    stack: error.stack,
    componentName: vm.$options.name,
    lifecycleHook: info,
    url: location.href,
  });
};
```

## Performance Monitoring

Use the Performance API to collect Core Web Vitals:

```javascript
// Largest Contentful Paint
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  report({ type: "lcp", value: lastEntry.startTime });
}).observe({ type: "largest-contentful-paint", buffered: true });

// First Input Delay
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    report({ type: "fid", value: entry.processingStart - entry.startTime });
  });
}).observe({ type: "first-input", buffered: true });
```

A solid monitoring system is the foundation of proactive site reliability — catch issues before users report them.
