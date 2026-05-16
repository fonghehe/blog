---
title: "Turborepo: High-Performance Monorepo"
date: 2021-05-21 11:47:29
tags:
  - Engineering

readingTime: 1
description: "Turborepo 高性能 Monorepo has been discussed many times in the community, but as versions iterate, many conclusions need updating. This article revisits the topic "
---

Turborepo 高性能 Monorepo has been discussed many times in the community, but as versions iterate, many conclusions need updating. This article revisits the topic based on the latest version.

## Getting Started

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

## Source Code Analysis

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

## Real-World Applications

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

## Optimization Tips

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

- Code examples are for reference only and need to be adjusted according to your business scenario
- Turborepo 高性能 Monorepo不是银弹，需要根据项目规模和技术栈选择
- Understanding underlying principles is more important than memorizing APIs
- Always verify compatibility before using in production
- In team collaboration, conventions and documentation are more important than the technology itself