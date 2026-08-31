---
title: "Node.js File Upload Handling"
date: 2020-05-13 14:53:22
tags:
  - Node.js
readingTime: 1
description: "Node.js file upload handling comes up often in day-to-day work, so I've put together a systematic summary to help everyone understand and apply it better."
wordCount: 148
---

Node.js file upload handling comes up often in day-to-day work, so I've put together a systematic write-up in the hope that it helps everyone understand and apply it better.

## Basic Concepts

Let's look at a concrete implementation:

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

This implementation is clean and efficient, and fits most scenarios.

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

In a real project you'd still need to adjust it to fit your specific requirements.

## Practical Application

The core code looks like this:

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

Make sure to handle edge cases and exceptional situations properly.

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

This pattern improves the maintainability of the code.

## Summary

- The core of Node.js file upload handling lies in understanding the underlying principles, not just memorizing the API.
- In real projects, picking the right approach matters more than chasing the newest technology.
- Keep a consistent code style across the team to lower maintenance cost.
