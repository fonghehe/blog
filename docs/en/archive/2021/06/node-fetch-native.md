---
title: "Node.js Native fetch API Preview"
date: 2021-06-03 14:50:28
tags:
  - JavaScript
  - Node.js

readingTime: 2
description: "Node.js's built-in fetch API preview has been discussed many times in the community, but versions move fast and many conclusions are outdated. This article revisits the topic against the latest release."
wordCount: 160
---

The Node.js native fetch API preview has been discussed many times in the community, but as versions iterate, a lot of the old conclusions need updating. This article revisits the topic based on the latest version.

## Getting Started

Let's start with the basic implementation:

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

This code demonstrates the basic usage. In real projects, you also need to consider error handling and edge cases.

## Source Code Analysis

Building on this foundation, we can further optimize:

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

This pattern is very practical in large projects and can significantly reduce maintenance costs.

## Real-World Applications

In real projects, usage gets a bit more involved:

```javascript
const express = require('express')
const app = express()

app.use(express.json())

class AppError extends Error {
  constructor(status, message) {
    super(message); this.statusCode = status
  }
}

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
  if (!user) throw new AppError(404, '用户不存在')
  res.json({ data: user })
}))

```

This makes the code both more testable and more scalable.

## Optimization Tips

Here is a complete example:

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

Handle edge cases carefully — they are critical in production.

## Summary

- In team collaboration, conventions and documentation are more important than the technology itself
- Stay updated with the community; technical solutions need continuous iteration
- Don't adopt new technology just for the sake of it