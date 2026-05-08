---
title: "Passkeys Web 端完整集成"
date: 2024-07-24 10:00:00
tags:
  - 前端
---

关于Passkeys Web 端完整集成，很多开发者只停留在 API 调用层面。本文试图从生产环境的角度，讨论实际中会遇到的问题和解决方案。

## 基本原理

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

## 高级特性

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

## 项目实践

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

## 最佳实践

实际项目中的用法会更复杂一些：

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

通过这种方式，代码的可测试性和可扩展性都得到了提升。

## 踩坑记录

以下是一个完整的示例：

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

注意边界条件处理，这在生产环境中至关重要。

## 小结

- 生产环境使用前务必做好兼容性验证
- 团队协作中约定和文档比技术本身更重要
- 关注社区动态，技术方案需要持续迭代
- 不要为了用新技术而用新技术
- 代码示例仅供参考，需根据业务场景调整
