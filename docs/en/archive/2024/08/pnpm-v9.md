---
title: "pnpm v9: New Features and Performance Improvements"
date: 2024-08-12 10:00:00
tags:
  - Engineering
readingTime: 1
description: "Regarding pnpm v9: New Features and Performance Improvements, many developers only stay at the API call level. This article discusses real-world problems and so"
---

Regarding pnpm v9: New Features and Performance Improvements, many developers only stay at the API call level. This article discusses real-world problems and solutions from a production environment perspective.

## Basic Principles

The key lies in understanding the core logic:

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

Performance optimization should be tailored to specific scenarios; not all cases require over-optimization.

## Advanced Features

We can improve it in the following ways:

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

This approach has been running stably in production for over six months and has been practically validated.

## Project Practice

Let's start with the basic implementation:

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

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Best Practices

Building on this foundation, we can further optimize:

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

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Summary

- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
- In team collaboration, conventions and documentation are more important than the technology itself
- Stay updated with the community, technical solutions need continuous iteration
