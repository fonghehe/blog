---
title: "JavaScript Proxy Pattern in Practice"
date: 2020-01-02 15:34:20
tags:
  - JavaScript
readingTime: 1
description: "The JavaScript Proxy pattern comes up often in day-to-day work, so I've put together a systematic summary to help everyone understand and apply it better."
wordCount: 147
---

I use the JavaScript Proxy pattern frequently in daily work, so I've put together a systematic summary, hoping it helps everyone understand and apply it better.

## Basic Concepts

Refer to the following code for the specific usage:

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

It's a good idea to standardize the convention across the team to reduce inconsistencies.

## Core Implementation

Here is a concrete implementation:

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

This approach is concise and efficient, and fits most scenarios.

## Practical Application

Here is a practical example:

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

In real projects, you'll still need to adapt it to your specific requirements.

## Best Practices

The core code looks like this:

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

Be sure to handle edge cases and exceptions properly.

## Summary

- Performance optimization should be based on real data—avoid premature optimization.
- The core of practicing the JavaScript Proxy pattern is understanding the underlying principles, not just memorizing APIs.
- In real projects, choosing the right approach matters more than chasing the latest technology.
