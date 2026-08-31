---
title: "tRPC Subscriptions and Real-Time"
date: 2023-11-22 17:22:59
tags:
  - Frontend
readingTime: 1
description: "tRPC subscriptions and real-time features has evolved quickly in recent years. This article digs into how it works and how to apply it in practice."
wordCount: 177
---

tRPC subscriptions and real-time features has evolved quickly in recent years. This article digs into how it works and how to apply it in practice.

## Basic Concepts

See the following code for specific usage:

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

It is recommended to unify conventions within the team to reduce inconsistency.

## Core Implementation

Let's look at the specific implementation:

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

This implementation is concise and efficient, suitable for most scenarios.

## Practical Application

Here is a practical example:

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

In real projects, you need to make appropriate adjustments based on specific requirements.

## Best Practices

The core code is as follows:

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

Be sure to handle edge cases and exceptions properly.

## Common Issues

We can implement it like this:

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

With this pattern, the code's maintainability improves.

## Summary

- Base performance optimization on real data and avoid premature optimization
- tRPC 订阅与实时的核心在于理解底层原理，而非仅仅记住 API
- In real projects, choosing the right solution matters more than chasing the newest technology
- Keep code style consistent across the team to cut maintenance costs