---
title: "Vue 3.2 Shallow Reactivity: shallowRef and shallowReactive"
date: 2022-02-03 10:05:35
tags:
  - Vue
  - React
readingTime: 1
description: "Frequently used in daily work, Vue 3.2 shallow reactivity deserves a systematic summary to help everyone better understand and apply it."
wordCount: 136
---

Frequently used in daily work, Vue 3.2 shallow reactivity deserves a systematic summary to help everyone better understand and apply it.

## Basic Concepts

Let's look at the specific implementation:

```javascript
// 使用示例
import { createApp } from './app'

const config = {
  apiBase: process.env.API_BASE || '/api',
  timeout: 10000,
  retries: 3
}

const app = createApp(config)
app.mount('#root')

```

This implementation is concise and efficient, suitable for most scenarios.

## Core Implementation

Here is a practical example:

```javascript
// 工具函数封装
function createHandler(options = {}) {
  const { timeout = 5000, retries = 3 } = options

  return async function execute(url, data) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)
        const res = await fetch(url, {
          method: 'POST',
          body: JSON.stringify(data),
          signal: controller.signal
        })
        clearTimeout(timer)
        return await res.json()
      } catch (err) {
        if (attempt === retries - 1) throw err
      }
    }
  }
}

```

In real projects, you need to make appropriate adjustments based on specific requirements.

## Practical Application

The core code is as follows:

```javascript
// 核心实现
const processData = (input) => {
  return input
    .filter(item => item.active)
    .map(item => ({
      ...item,
      displayName: item.name.trim(),
      timestamp: Date.now()
    }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

```

Be sure to handle edge cases and exceptions properly.

## Best Practices

We can implement it like this:

```javascript
// 使用示例
import { createApp } from './app'

const config = {
  apiBase: process.env.API_BASE || '/api',
  timeout: 10000,
  retries: 3
}

const app = createApp(config)
app.mount('#root')

```

Through this pattern, the maintainability of the code is improved.

## Summary

- The key to Vue 3.2 shallow reactivity is understanding the underlying principles, not just memorizing APIs
- In real projects, choosing the right solution is more important than chasing the latest technology
- Maintaining consistent code style in team collaboration reduces maintenance costs