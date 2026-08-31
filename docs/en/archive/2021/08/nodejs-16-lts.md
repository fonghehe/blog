---
title: "Node.js 16 LTS Developer Guide"
date: 2021-08-30 15:09:25
tags:
  - JavaScript
  - Node.js

readingTime: 2
description: "Node.js 16 shipped in April 2021 and entered LTS in October. As the runtime foundation of the frontend toolchain, the Node.js version directly affects tools like Vite, Webpack 5, and esbuild. Here are the v16 features worth watching."
wordCount: 205
---

Node.js 16 was released in April 2021 and entered the LTS stage in October. As the runtime foundation of the frontend toolchain, the Node.js version directly affects how build tools like Vite, Webpack 5, and esbuild perform. Here's a roundup of the notable features in v16.

## V8 Engine Upgraded to 9.0

Node.js 16 ships with V8 9.0, bringing several handy new APIs:

```javascript
// Array.prototype.at - 支持负索引
const arr = [1, 2, 3, 4, 5]
arr.at(-1)   // 5
arr.at(-2)   // 4

// Object.hasOwn - 替代 hasOwnProperty
const obj = { name: 'test' }
Object.hasOwn(obj, 'name')      // true
Object.hasOwn(obj, 'toString')  // false

// Error.cause - 链式错误追踪
try {
  await fetchUser()
} catch (err) {
  throw new Error('获取用户信息失败', { cause: err })
}

// 捕获时可以追溯原始错误
try {
  main()
} catch (err) {
  console.log(err.message)        // '获取用户信息失败'
  console.log(err.cause.message)  // 原始错误信息
}
```

## Experimental Fetch API Support

Node.js 16 starts shipping a built-in Fetch API experimentally (based on undici):

```javascript
// 启用：需要加 --experimental-fetch 标志
// node --experimental-fetch app.js

async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

// 支持 AbortController
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

try {
  const res = await fetch(url, { signal: controller.signal })
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('请求超时')
  }
}
```

Although still experimental, this means you no longer need to install `node-fetch` or `axios` for simple HTTP requests going forward.

## Timers Promises API

The `timers/promises` module provides Promise-based versions of the timers:

```javascript
import { setTimeout, setInterval } from 'timers/promises'

// 等待 1 秒，不需要 new Promise 包装
await setTimeout(1000)

// 带取消支持
const ac = new AbortController()
setTimeout(1000, null, { signal: ac.signal })
  .catch(err => {
    if (err.name === 'AbortError') console.log('定时器取消')
  })

// async 迭代的 setInterval
for await (const _ of setInterval(1000)) {
  console.log('每秒执行一次')
  if (shouldStop) break
}
```

## AbortController Available Globally

In Node.js 16, `AbortController` is available globally, so no polyfill is needed:

```javascript
// 全局直接使用，不需要 import
const controller = new AbortController()

// 配合 fs 操作（Node.js 16.7+）
import { readFile } from 'fs/promises'

const ac = new AbortController()
const promise = readFile('large-file.txt', { signal: ac.signal })
ac.abort() // 中断文件读取
```

## Migration Notes

When upgrading from Node.js 14 to 16, keep the following in mind:

```bash
# 1. 检查 node-sass 依赖
# node-sass 需要针对 Node 版本编译二进制文件
# 建议迁移到 dart sass（sass 包）
npm uninstall node-sass
npm install sass

# 2. OpenSSL 3.0 兼容性
# Node.js 16 使用 OpenSSL 3.0，某些旧的加密算法默认禁用
# 如果遇到 ERR_OSSL_EVP_UNSUPPORTED，可以设置：
export NODE_OPTIONS=--openssl-legacy-provider

# 3. npm 版本
# Node.js 16 自带 npm 7/8，lockfile 格式从 v1 升级到 v2
# 团队内统一 Node 版本，避免 lockfile 冲突
```

## Summary

- `Array.at()`, `Object.hasOwn()`, and `Error.cause` are the most practical new APIs
- A built-in Fetch API is the direction of travel, even though it's still experimental for now
- `timers/promises` finally removes the need to hand-write Promise-based timers
- When migrating from Node 14, watch out for node-sass and OpenSSL 3.0 compatibility
- It's a good idea for teams to standardize on nvm or fnm to manage the Node version