---
title: "Resource Hints Optimization"
date: 2021-06-23 17:22:51
tags:
  - Performance Optimization
  - Frontend
  - TypeScript

readingTime: 1
description: "I recently applied Resource Hints optimization with my team and accumulated quite a bit of experience. Here's a write-up for anyone doing similar work."
wordCount: 183
---

We recently rolled out Resource Hints optimization across our team and picked up quite a bit of experience along the way. I'm writing it up as a reference, hoping it helps anyone doing similar work.

## Core Concepts

In real projects, usage gets a bit more involved:

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

This makes the code both more testable and more scalable.

## In-Depth Analysis

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

Handle edge cases carefully — they are critical in production.

## Implementation Experience

The key is understanding the core logic:

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

## Optimization Strategies

Here are a few ways to take this further:

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

This approach has run stably in production for over six months, so it's proven in practice.

## Summary

- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Resource Hints optimization isn't a silver bullet — pick it based on your project's scale and tech stack
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production