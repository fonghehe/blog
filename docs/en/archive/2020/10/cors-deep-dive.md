---
title: "CORS: A Deep Dive into Cross-Origin Resource Sharing"
date: 2020-10-01 10:58:45
tags:
  - Security
readingTime: 2
description: "A refreshed deep dive into CORS (Cross-Origin Resource Sharing), re-examining earlier community conclusions in light of updated browser behavior."
wordCount: 200
---

The topic of CORS (Cross-Origin Resource Sharing) has been discussed in the community many times, but with each version iteration a lot of the old conclusions need updating. This article re-examines it based on the latest version.

## Getting Started

In real projects, the usage gets a bit more involved:

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

This approach improves both the testability and extensibility of the code.

## Source Code Analysis

Here is a complete example:

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

Pay attention to edge-case handling — it's critical in production.

## Real-World Applications

The key is understanding the core logic:

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

Performance optimization has to be tied to the actual scenario; not every case calls for over-optimizing.

## Optimization Tips

Here's how we can improve on it:

```javascript
function setCSP(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64')
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.example.com",
    "frame-ancestors 'none'"
  ].join('; '))
  next()
}

```

This approach has been running stably in production for over half a year, so it's proven in practice.

## Summary

- In team collaboration, conventions and documentation matter more than the technology itself.
- Keep an eye on community developments; technical solutions need continuous iteration.
- Don't adopt new tech for its own sake.
- The code examples are for reference only and should be adapted to your actual use case.
- A deep dive into CORS (Cross-Origin Resource Sharing) is no silver bullet; choose it based on your project's scale and tech stack.
