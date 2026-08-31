---
title: "CSS Animation Performance Optimization Strategies"
date: 2019-08-30 10:47:06
tags:
  - CSS
readingTime: 1
description: "Many developers misunderstand CSS animation performance optimization. This article systematically covers the key concepts and common pitfalls."
wordCount: 125
---

Many readers misunderstand CSS animation performance optimization. This article systematically sorts out the key points and common pitfalls.

## Basic Concepts

We can implement it as follows:

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

Note the performance details in the code above and avoid unnecessary computation.

## Deep Dive

See the following code for a concrete implementation:

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

This approach has been validated in production and runs stably.

## Project Application

Let's start with the basic usage:

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

This style is clear and concise, and fits most scenarios.

## Summary

- Keep learning and summarizing to stay sensitive to new techniques.
- When you hit a problem, read the source code and official docs.
- The key to CSS animation performance optimization is understanding the core concepts, not just superficial usage.
- In real projects, pick the right approach for the situation.
