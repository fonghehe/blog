---
title: "Lighthouse Performance Optimization Checklist"
date: 2020-07-29 16:34:33
tags:
  - Performance Optimization
readingTime: 1
description: "最近在团队中落地Lighthouse 性能优化清单，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
---

最近在团队中落地Lighthouse 性能优化清单，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## Core Concepts

先来看基本的实现方式：

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

这段代码展示了基本的使用方式。实际项目中还需要考虑错误处理和边界条件。

## In-Depth Analysis

在这个基础上，我们可以进一步优化：

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

这种模式在大型项目中非常实用，能显著降低维护成本。

## Implementation Experience

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## Tuning Strategies

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## Summary

- Lighthouse 性能优化清单不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
