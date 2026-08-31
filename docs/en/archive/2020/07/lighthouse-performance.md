---
title: "Lighthouse Performance Optimization Checklist"
date: 2020-07-29 16:34:33
tags:
  - Performance Optimization
readingTime: 1
description: "Lessons learned from rolling out a Lighthouse performance optimization checklist across the team, shared as a practical reference for similar efforts."
wordCount: 164
---

I recently rolled out a Lighthouse performance optimization checklist across the team and picked up a lot of experience along the way. I'm sharing it here in case it helps others doing similar work.

## Core Concepts

Let's look at the basic implementation first:

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

This snippet shows the basic usage. In real projects you'll also need to consider error handling and edge cases.

## In-Depth Analysis

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

This pattern is very useful in large projects and can significantly cut maintenance cost.

## Implementation Experience

Usage in real projects is a bit more complex:

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

This approach improves both the testability and extensibility of the code.

## Tuning Strategies

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

Pay close attention to edge cases — this is critical in production.

## Summary

- A Lighthouse performance checklist is no silver bullet; choose it based on your project's size and tech stack.
- Understanding the underlying principles matters more than memorizing APIs.
- Be sure to verify compatibility before using it in production.
