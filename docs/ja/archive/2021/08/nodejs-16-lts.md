---
title: "Node.js 16 LTS 開発者ガイド"
date: 2021-08-30 15:09:25
tags:
  - JavaScript
  - Node.js

readingTime: 2
description: "Node.js 16 在 2021 年 4 月发布，10 月进入 LTS 阶段。作为前端工具链的运行时基础，Node.js 版本直接影响 Vite、Webpack 5、esbuild 等构建工具的表现。整理一下 v16 中值得关注的特性。"
wordCount: 434
---

Node.js 16 は 2021 年 4 月にリリースされ、10 月に LTS フェーズに入った。フロントエンドのツールチェーンにおけるランタイムの基盤として、Node.js のバージョンは Vite、Webpack 5、esbuild といったビルドツールの動作に直結する。v16 で注目すべき機能を整理する。

## V8 エンジンが 9.0 にアップグレード

Node.js 16 は V8 9.0 を搭載し、いくつかの実用的な新 API が追加された：

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

## Fetch API の実験的サポート

Node.js 16 から、Fetch API が実験的に組み込まれた（undici ベース）：

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

まだ実験的な機能だが、これで単純な HTTP リクエストのために `node-fetch` や `axios` を別途導入する必要がなくなる。

## Timers Promises API

`timers/promises` モジュールは、Promise 版のタイマーを提供する：

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

## AbortController がグローバルに利用可能に

Node.js 16 では `AbortController` がグローバルに使えるようになり、polyfill は不要になった：

```javascript
// 全局直接使用，不需要 import
const controller = new AbortController()

// 配合 fs 操作（Node.js 16.7+）
import { readFile } from 'fs/promises'

const ac = new AbortController()
const promise = readFile('large-file.txt', { signal: ac.signal })
ac.abort() // 中断文件读取
```

## 移行時の注意点

Node.js 14 から 16 へアップグレードする際の注意点：

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

## まとめ

- `Array.at()`、`Object.hasOwn()`、`Error.cause` は最も実用的な新 API だ
- Fetch API の内蔵は今後のトレンドだが、現時点ではまだ実験的だ
- `timers/promises` の登場で、タイマーの Promise 化を自前で書く必要がなくなった
- Node 14 からの移行では node-sass と OpenSSL 3.0 の互換性に注意が必要だ
- チームでは nvm や fnm で Node のバージョンを統一することをおすすめする