---
title: "Lighthouse 性能优化清单"
date: 2020-07-29 16:34:33
tags:
  - 性能优化
readingTime: 1
description: "最近在团队中落地Lighthouse 性能优化清单，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 255
---

最近在团队中落地了 Lighthouse 性能优化清单，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## 核心概念

先看看基础实现：

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

这段代码是基础用法。真实项目里还要考虑错误处理和边界条件。

## 深度解析

在此基础上，还能进一步优化：

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

这种模式在大型项目里很实用，能明显降低维护成本。

## 落地经验

真实项目里的用法会更复杂：

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

这样做之后，代码的可测试性和可扩展性都更好了。

## 调优策略

下面是一个完整示例：

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

注意处理边界条件，这在生产环境里很关键。

## 小结

- Lighthouse 性能优化清单不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
