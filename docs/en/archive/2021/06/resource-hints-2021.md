---
title: "Resource Hints Optimization"
date: 2021-06-23 17:22:51
tags:
  - Performance Optimization
  - Frontend
  - TypeScript

readingTime: 1
description: "最近在团队中落地Resource Hints 资源提示优化， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work."
---

最近在团队中落地Resource Hints 资源提示优化， and accumulated quite a bit of experience. Here's a summary for reference, hoping it helps those doing similar work.

## Core Concepts

实际项目中的用法会更复杂一些：

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

Through this approach, both the testability and scalability of the code are improved.

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

Pay attention to boundary condition handling, which is critical in production.

## Implementation Experience

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

## Optimization Strategies

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

## Summary

- Don't adopt new technology just for the sake of it
- Code examples are for reference only and need to be adjusted according to your business scenario
- Resource Hints 资源提示优化不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production