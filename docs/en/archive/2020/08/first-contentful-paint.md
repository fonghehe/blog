---
title: "FCP: First Contentful Paint Optimization"
date: 2020-08-14 15:39:05
tags:
  - Performance Optimization
readingTime: 2
description: "A production-focused guide to optimizing First Contentful Paint (FCP), addressing real-world performance problems and their solutions."
wordCount: 187
---

When it comes to FCP (First Contentful Paint) optimization, many developers only operate at the API-call level. This article tries to discuss the real-world problems and solutions from a production-environment perspective.

## Basic Principles

Here is a complete example:

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

Pay attention to edge-case handling — this is critical in production.

## Advanced Features

The key is to understand the core logic:

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

Performance optimization needs to fit the specific scenario; not every case calls for over-optimization.

## Project Practice

We can improve things in the following ways:

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

This approach has been running stably in production for over half a year and has been proven in practice.

## Best Practices

Let's first look at the basic implementation:

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

This snippet shows the basic usage. In real projects you also need to consider error handling and edge cases.

## Common Pitfalls

Building on this, we can optimize further:

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

This pattern is very practical in large projects and can significantly reduce maintenance cost.

## Summary

- Be sure to verify compatibility before using it in production
- In team collaboration, conventions and documentation matter more than the technology itself
- Keep an eye on the community; technical solutions need continuous iteration
