---
title: "Bun 1.1 新特性與改進"
date: 2024-04-19 11:47:43
tags:
  - 前端
readingTime: 2
description: "關於Bun 1.1 新特性與改進，很多開發者只停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。"
---

關於Bun 1.1 新特性與改進，很多開發者只停留在 API 調用層面。本文試圖從生產環境的角度，討論實際中會遇到的問題和解決方案。

## 基本原理

先來看基本的實現方式：

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

這段代碼展示了基本的使用方式。實際項目中還需要考慮錯誤處理和邊界條件。

## 高級特性

在這個基礎上，我們可以進一步優化：

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

這種模式在大型項目中非常實用，能顯著降低維護成本。

## 項目實踐

實際項目中的用法會更復雜一些：

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

通過這種方式，代碼的可測試性和可擴展性都得到了提升。

## 最佳實踐

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 小結

- 理解底層原理比記住 API 更重要
- 生產環境使用前務必做好兼容性驗證
- 團隊協作中約定和文檔比技術本身更重要