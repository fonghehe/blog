---
title: "CSS 动画性能优化策略"
date: 2019-08-30 10:47:06
tags:
  - CSS
readingTime: 1
description: "很多同学在CSS 动画性能优化策略上存在理解偏差，本文系统地梳理核心要点和常见误区。"
---

很多同学在CSS 动画性能优化策略上存在理解偏差，本文系统地梳理核心要点和常见误区。

## 基本概念

我们可以通过以下方式实现：

```css
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj
  if (map.has(obj)) return map.get(obj)

  const clone = Array.isArray(obj) ? [] : {}
  map.set(obj, clone)

  for (const key of Object.keys(obj)) {
    clone[key] = deepClone(obj[key], map)
  }
  return clone
}
```

注意上面代码中的性能细节，避免不必要的计算。

## 深入理解

具体实现参考以下代码：

```css
function pLimit(concurrency) {
  const queue = []
  let active = 0

  const next = () => {
    if (active >= concurrency || queue.length === 0) return
    active++
    const { fn, resolve, reject } = queue.shift()
    fn().then(resolve, reject).finally(() => {
      active--
      next()
    })
  }

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    next()
  })
}
```

经过线上验证，这套方案运行稳定。

## 项目应用

先来看基本的用法：

```css
class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  on(event, handler) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(handler)
    return () => this.off(event, handler)
  }

  off(event, handler) {
    const handlers = this.events.get(event)
    if (handlers) {
      const idx = handlers.indexOf(handler)
      if (idx > -1) handlers.splice(idx, 1)
    }
  }

  emit(event, ...args) {
    const handlers = this.events.get(event) || []
    handlers.forEach(h => h(...args))
  }
}
```

这种写法简洁明了，适合大多数场景。

## 小结

- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
- CSS 动画性能优化策略的关键在于理解核心概念，不要停留在表面用法
- 实际项目中根据场景选择合适的方案
