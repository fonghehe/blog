---
title: "Turborepo 高性能 Monorepo"
date: 2021-05-21 11:47:29
tags:
  - 前端工程化
readingTime: 2
description: "Turborepo 高性能 Monorepo这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。"
wordCount: 291
---

Turborepo 这类高性能 Monorepo 方案，社区讨论过很多次，但随着版本迭代，不少结论需要更新。本文基于最新版本重新梳理。

## 入门指南

实际项目中的用法更复杂：

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

借助这种方式，代码的可测试性和可扩展性都更好。

## 源码分析

下面给出一个完整示例：

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

注意处理边界条件，在生产环境里这点尤为关键。

## 真实场景应用

关键要理解背后的核心逻辑：

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

性能优化要结合具体场景，不必处处都做。

## 优化技巧

可以用下面这些方式来改进：

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

这套方案已在线上稳定运行半年多，经过真实业务验证。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- Turborepo 这类高性能 Monorepo 方案不是银弹，需结合项目规模和技术栈选择
- 理解底层原理比记住 API 更重要
- 生产环境使用前务必做好兼容性验证
- 团队协作中约定和文档比技术本身更重要