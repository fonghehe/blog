---
title: "Node.js 16 LTS 開發指南"
date: 2021-08-30 15:09:25
tags:
  - Node.js
  - JavaScript
readingTime: 2
description: "Node.js 16 在 2021 年 4 月釋出，10 月進入 LTS 階段。作為前端工具鏈的執行時基礎，Node.js 版本直接影響 Vite、Webpack 5、esbuild 等構建工具的表現。整理一下 v16 中值得關注的特性。"
wordCount: 267
---

Node.js 16 在 2021 年 4 月釋出，10 月進入 LTS 階段。作為前端工具鏈的執行時基礎，Node.js 版本直接影響 Vite、Webpack 5、esbuild 等構建工具的表現。整理一下 v16 中值得關注的特性。

## V8 引擎升級到 9.0

Node.js 16 搭載 V8 9.0，帶來了幾個實用的新 API：

```javascript
// Array.prototype.at - 支援負索引
const arr = [1, 2, 3, 4, 5]
arr.at(-1)   // 5
arr.at(-2)   // 4

// Object.hasOwn - 替代 hasOwnProperty
const obj = { name: 'test' }
Object.hasOwn(obj, 'name')      // true
Object.hasOwn(obj, 'toString')  // false

// Error.cause - 鏈式錯誤追蹤
try {
  await fetchUser()
} catch (err) {
  throw new Error('獲取使用者資訊失敗', { cause: err })
}

// 捕獲時可以追溯原始錯誤
try {
  main()
} catch (err) {
  console.log(err.message)        // '獲取使用者資訊失敗'
  console.log(err.cause.message)  // 原始錯誤資訊
}
```

## Fetch API 實驗性支援

Node.js 16 開始實驗性地內建 Fetch API（基於 undici）：

```javascript
// 啟用：需要加 --experimental-fetch 標誌
// node --experimental-fetch app.js

async function getUser(id) {
  const response = await fetch(`https://api.example.com/users/${id}`)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

// 支援 AbortController
const controller = new AbortController()
setTimeout(() => controller.abort(), 5000)

try {
  const res = await fetch(url, { signal: controller.signal })
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('請求超時')
  }
}
```

雖然還是實驗性功能，但意味著以後不用再裝 `node-fetch` 或 `axios` 做簡單的 HTTP 請求了。

## Timers Promises API

`timers/promises` 模組提供了 Promise 版本的定時器：

```javascript
import { setTimeout, setInterval } from 'timers/promises'

// 等待 1 秒，不需要 new Promise 包裝
await setTimeout(1000)

// 帶取消支援
const ac = new AbortController()
setTimeout(1000, null, { signal: ac.signal })
  .catch(err => {
    if (err.name === 'AbortError') console.log('定時器取消')
  })

// async 迭代的 setInterval
for await (const _ of setInterval(1000)) {
  console.log('每秒執行一次')
  if (shouldStop) break
}
```

## AbortController 全域性可用

Node.js 16 中 `AbortController` 變成全域性可用，不再需要 polyfill：

```javascript
// 全域性直接使用，不需要 import
const controller = new AbortController()

// 配合 fs 操作（Node.js 16.7+）
import { readFile } from 'fs/promises'

const ac = new AbortController()
const promise = readFile('large-file.txt', { signal: ac.signal })
ac.abort() // 中斷檔案讀取
```

## 遷移注意事項

從 Node.js 14 升級到 16，需要注意：

```bash
# 1. 檢查 node-sass 依賴
# node-sass 需要針對 Node 版本編譯二進位制檔案
# 建議遷移到 dart sass（sass 包）
npm uninstall node-sass
npm install sass

# 2. OpenSSL 3.0 相容性
# Node.js 16 使用 OpenSSL 3.0，某些舊的加密演算法預設停用
# 如果遇到 ERR_OSSL_EVP_UNSUPPORTED，可以設定：
export NODE_OPTIONS=--openssl-legacy-provider

# 3. npm 版本
# Node.js 16 自帶 npm 7/8，lockfile 格式從 v1 升級到 v2
# 團隊內統一 Node 版本，避免 lockfile 衝突
```

## 小結

- `Array.at()`、`Object.hasOwn()`、`Error.cause` 是最實用的新 API
- Fetch API 內建是趨勢，雖然目前還是實驗性
- `timers/promises` 終於讓定時器的 Promise 化不再手寫
- 從 Node 14 遷移要注意 node-sass 和 OpenSSL 3.0 相容性
- 建議團隊統一使用 nvm 或 fnm 管理 Node 版本