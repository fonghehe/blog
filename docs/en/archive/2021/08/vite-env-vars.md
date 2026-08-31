---
title: "Vite Environment Variable Management"
date: 2021-08-13 11:13:14
tags:
  - Vite
  - Engineering

readingTime: 1
description: "Environment variable management in Vite has evolved quickly in recent years. This article digs into how it works and how to handle it in practice."
wordCount: 138
---

Vite environment variable management has evolved rapidly in recent years. This article takes an in-depth look at its principles and practical approaches.

## Basic Concepts

Here is one way to implement it:

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

This pattern improves the code's maintainability.

## Core Implementation

See the following code for specific usage:

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

It is recommended to unify conventions within the team to reduce inconsistency.

## Practical Application

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

## Best Practices

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

## Summary

- Keep an eye on community developments and update your approach in a timely manner
- Performance optimization should be grounded in real data; avoid over-optimizing
- The core of Vite environment variable management is understanding the underlying principles, not just memorizing the API