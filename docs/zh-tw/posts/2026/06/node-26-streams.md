---
title: "Node.js 26 Streams 重構：ReadableStream 與 Web Streams 的統一"
date: 2026-06-10 15:59:13
tags:
  - Node.js
readingTime: 2
description: "Node.js 26 重構了 Streams 實現，統一了 Node.js Streams 和 Web Streams API。本文深入分析新的 Streams 架構，講解如何在實際專案中利用這些改進提升 I/O 效能。"
wordCount: 243
---

Node.js 的 Streams 一直是處理大規模 I/O 的核心能力，但 Node.js Streams 和 Web Streams 兩套 API 的並存給開發者帶來了選擇困難。Node.js 26 透過底層重構，在保持向後相容的同時，讓兩套 API 的互操作變得更加順暢。

## 雙 Streams 體系的現狀

在 Node.js 26 之前，Streams 存在兩個平行的體系：

```javascript
// Node.js Streams（傳統）
const { Readable, Writable, Transform } = require('node:stream')
const fs = require('node:fs')

const readStream = fs.createReadStream('file.txt')
const writeStream = fs.createWriteStream('output.txt')
readStream.pipe(transformStream).pipe(writeStream)

// Web Streams（現代標準）
const response = await fetch('https://api.example.com/data')
const reader = response.body.getReader()
const writable = writableStream.getWriter()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  await writable.write(value)
}
```

## Node.js 26 的統一策略

Node.js 26 採用了「漸進統一」的策略，在底層實現了兩套 API 的無縫互操作：

### ReadableStream 增強

```javascript
import { ReadableStream } from 'node:stream/web'
import { createReadStream } from 'node:fs'

// Node.js 26：直接從 fs.createReadStream 建立 Web ReadableStream
const nodeStream = createReadStream('large-file.txt')
const webStream = ReadableStream.from(nodeStream)

// Web ReadableStream 可以直接用於 fetch
const response = new Response(webStream, {
  headers: { 'Content-Type': 'text/plain' }
})
```

### TransformStream 互操作

```javascript
import { TransformStream } from 'node:stream/web'

const upperCaseTransform = new TransformStream({
  transform(chunk, controller) {
    const text = new TextDecoder().decode(chunk)
    controller.enqueue(new TextEncoder().encode(text.toUpperCase()))
  }
})

import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'

await pipeline(
  createReadStream('input.txt'),
  upperCaseTransform,  // Web TransformStream 直接使用
  createWriteStream('output.txt')
)
```

## 非同步迭代器：現代 Streams 的最佳實踐

```javascript
import { createReadStream } from 'node:fs'

async function* processLines(readable) {
  let buffer = ''
  
  for await (const chunk of readable) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line)
      }
    }
  }
  
  if (buffer.trim()) {
    yield JSON.parse(buffer)
  }
}
```

## 背壓處理的簡化

```javascript
import { Writable } from 'node:stream'

// Node.js 26：自動背壓處理
const writable = new Writable({
  write(chunk, encoding, callback) {
    setTimeout(() => {
      console.log('Processed:', chunk.toString())
      callback()  // callback 完成後才會繼續寫入下一個 chunk
    }, 100)
  },
  highWaterMark: 16 * 1024  // 16KB
})
```

## 錯誤處理最佳實踐

```javascript
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'

async function processFile(inputPath, outputPath) {
  try {
    await pipeline(
      createReadStream(inputPath),
      transformStream,
      createWriteStream(outputPath)
    )
    console.log('檔案處理成功')
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('找不到輸入檔案')
    } else if (err.code === 'EACCES') {
      console.error('權限不足')
    } else {
      console.error('Stream 處理失敗:', err.message)
    }
    throw err
  }
}
```

## 小結

Node.js 26 的 Streams 重構讓 Node.js Streams 和 Web Streams 兩套 API 實現了真正的互操作。強化的非同步迭代器支援、簡化的背壓處理、以及與 Fetch API 的深度整合，讓 Streams 程式設計變得更加直觀和高效。
