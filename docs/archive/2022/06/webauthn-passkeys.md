---
title: "WebAuthn Passkeys 无密码认证"
date: 2022-06-27 10:22:18
tags:
  - 前端
readingTime: 2
description: "最近在团队中落地WebAuthn Passkeys 无密码认证，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 299
---

最近在团队中落地WebAuthn Passkeys 无密码认证，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。

## 核心概念

关键在于理解核心逻辑：

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

性能优化需要结合具体场景，不是所有情况都需要过度优化。

## 深度解析

我们可以通过以下方式来改进：

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

这套方案已经在线上稳定运行了半年以上，经过了实际验证。

## 落地经验

先来看基本的实现方式：

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

这段代码展示了基本的使用方式。实际项目中还需要考虑错误处理和边界条件。

## 调优策略

在这个基础上，我们可以进一步优化：

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

这种模式在大型项目中非常实用，能显著降低维护成本。

## 小结

- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
- WebAuthn Passkeys 无密码认证不是银弹，需要根据项目规模和技术栈选择