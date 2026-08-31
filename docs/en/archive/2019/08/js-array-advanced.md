---
title: "JavaScript Array Advanced Methods"
date: 2019-08-20 11:02:36
tags:
  - JavaScript
readingTime: 1
description: "While rolling out advanced JavaScript array methods across the team, we hit quite a few pitfalls. Sharing them here in the hope they help others."
wordCount: 134
---

While rolling out advanced JavaScript array methods across the team, we hit quite a few pitfalls. I'm sharing them here in the hope they help others.

## Basic Concepts

The core code is as follows:

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

In real projects you also need to consider edge cases and error handling.

## Deep Dive

Here is a concrete example:

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

After this pattern was adopted by the team, results were good and maintenance cost dropped noticeably.

## Project Application

We can implement it as follows:

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

Note the performance details in the code above and avoid unnecessary computation.

## Summary

- In real projects, pick the right approach for the situation.
- Agreeing on team-wide conventions matters more than chasing the perfect implementation.
- Keep learning and summarizing to stay sensitive to new techniques.
- When you hit a problem, read the source code and official docs.
