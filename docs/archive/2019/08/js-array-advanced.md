---
title: "JavaScript 数组高级方法"
date: 2019-08-20 11:02:36
tags:
  - JavaScript
---

在团队推广JavaScript 数组高级方法的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## 基本概念

核心代码如下：

```javascript
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

实际项目中还需要考虑边界条件和异常处理。

## 深入理解

下面是一个实际的例子：

```javascript
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

这种模式在团队中推广后效果很好，维护成本明显降低。

## 项目应用

我们可以通过以下方式实现：

```javascript
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

注意上面代码中的性能细节，避免不必要的计算。

## 小结

- 实际项目中根据场景选择合适的方案
- 团队中统一约定比追求完美实现更重要
- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
