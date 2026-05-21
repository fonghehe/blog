---
title: "PM2 Node.js 生產環境部署"
date: 2020-06-22 15:28:23
tags:
  - Node.js
readingTime: 2
description: "在日常開發中，PM2 Node.js 生產環境部署的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。"
wordCount: 325
---

在日常開發中，PM2 Node.js 生產環境部署的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。

## 快速上手

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 內部原理

實際專案中的用法會更復雜一些：

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

通過這種方式，程式碼的可測試性和可擴充套件性都得到了提升。

## 業務實戰

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

## 效能對比

關鍵在於理解核心邏輯：

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

效能最佳化需要結合具體場景，不是所有情況都需要過度最佳化。

## 問題排查

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 小結

- 團隊協作中約定和文件比技術本身更重要
- 關注社群動態，技術方案需要持續迭代
- 不要為了用新技術而用新技術
- 程式碼示例僅供參考，需根據業務場景調整
