---
title: "Node.js 26 Streams 重构：ReadableStream 与 Web Streams 的统一"
date: 2026-06-10 15:59:13
tags:
  - Node.js
readingTime: 4
description: "Node.js 26 重构了 Streams 实现，统一了 Node.js Streams 和 Web Streams API。本文深入分析新的 Streams 架构，讲解如何在实际项目中利用这些改进提升 I/O 性能。"
wordCount: 466
---

Node.js 的 Streams 一直是处理大规模 I/O 的核心能力，但 Node.js Streams 和 Web Streams 两套 API 的并存给开发者带来了选择困难。Node.js 26 通过底层重构，在保持向后兼容的同时，让两套 API 的互操作变得更加顺畅。

## 双 Streams 体系的现状

在 Node.js 26 之前， Streams 存在两个平行的体系：

```javascript
// Node.js Streams（传统）
const { Readable, Writable, Transform } = require('node:stream')
const fs = require('node:fs')

const readStream = fs.createReadStream('file.txt')
const writeStream = fs.createWriteStream('output.txt')
readStream.pipe(transformStream).pipe(writeStream)

// Web Streams（现代标准）
const response = await fetch('https://api.example.com/data')
const reader = response.body.getReader()
const writable = writableStream.getWriter()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  await writable.write(value)
}
```

两套 API 的差异不仅在语法上，更在底层实现和性能特征上。

## Node.js 26 的统一策略

Node.js 26 采用了"渐进统一"的策略，在底层实现了两套 API 的无缝互操作：

### ReadableStream 增强

```javascript
import { ReadableStream } from 'node:stream/web'
import { createReadStream } from 'node:fs'

// Node.js 26：直接从 fs.createReadStream 创建 Web ReadableStream
const nodeStream = createReadStream('large-file.txt')
const webStream = ReadableStream.from(nodeStream)

// Web ReadableStream 可以直接用于 fetch
const response = new Response(webStream, {
  headers: { 'Content-Type': 'text/plain' }
})

// 反向转换：Web Stream 转 Node Stream
const webReadable = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('hello'))
    controller.close()
  }
})

const { Readable } = await import('node:stream')
const nodeReadable = Readable.fromWeb(webReadable)
```

### TransformStream 互操作

```javascript
import { TransformStream } from 'node:stream/web'

// 创建一个 Web TransformStream
const upperCaseTransform = new TransformStream({
  transform(chunk, controller) {
    const text = new TextDecoder().decode(chunk)
    controller.enqueue(new TextEncoder().encode(text.toUpperCase()))
  }
})

// 可以直接用于 Node.js pipe
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'

await pipeline(
  createReadStream('input.txt'),
  upperCaseTransform,  // Web TransformStream 直接使用
  createWriteStream('output.txt')
)
```

## 异步迭代器：现代 Streams 的最佳实践

Node.js 26 强化了异步迭代器支持，这是处理 Streams 最直观的方式：

```javascript
import { createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

// 使用 for await...of 遍历 ReadableStream
const stream = createReadStream('data.json', { encoding: 'utf8' })
const chunks = []

for await (const chunk of stream) {
  chunks.push(chunk)
}

const data = JSON.parse(chunks.join(''))

// 异步迭代器 + TransformStream 的组合
async function* processLines(readable) {
  let buffer = ''
  
  for await (const chunk of readable) {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop()  // 保留不完整的行
    
    for (const line of lines) {
      if (line.trim()) {
        yield JSON.parse(line)
      }
    }
  }
  
  // 处理最后一行
  if (buffer.trim()) {
    yield JSON.parse(buffer)
  }
}

// 使用
const fileStream = createReadStream('events.jsonl')
for await (const event of processLines(fileStream)) {
  console.log('Event:', event.type)
}
```

## 背压处理的简化

背压（Backpressure）是 Streams 编程中最容易出错的部分。Node.js 26 简化了背压处理：

```javascript
import { Writable } from 'node:stream'

// Node.js 26：自动背压处理
const writable = new Writable({
  write(chunk, encoding, callback) {
    // 模拟异步处理
    setTimeout(() => {
      console.log('Processed:', chunk.toString())
      callback()  // callback 完成后才会继续写入下一个 chunk
    }, 100)
  },
  // 高水位线：缓冲区大小
  highWaterMark: 16 * 1024
})

// 使用 pipeline 自动处理背压
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'

await pipeline(
  createReadStream('large-input.bin'),
  new Transform({
    transform(chunk, encoding, callback) {
      // 处理数据
      this.push(processChunk(chunk))
      callback()
    }
  }),
  createWriteStream('output.bin')
)
```

## 性能优化：HighWaterMark 调优

`highWaterMark` 是控制 Streams 内存使用的关键参数：

```javascript
import { Readable } from 'node:stream'

// 低延迟场景：较小的 highWaterMark
const lowLatencyStream = new Readable({
  read() {
    // 每次读取较小的数据块
  },
  highWaterMark: 16 * 1024  // 16KB
})

// 高吞吐场景：较大的 highWaterMark
const highThroughputStream = new Readable({
  read() {
    // 每次读取较大的数据块
  },
  highWaterMark: 256 * 1024  // 256KB
})

// 根据实际场景调整
async function optimizeStreamForUseCase(stream, useCase) {
  switch (useCase) {
    case 'realtime':
      stream.readableHighWaterMark = 8 * 1024  // 8KB
      break
    case 'batch':
      stream.readableHighWaterMark = 512 * 1024  // 512KB
      break
    case 'default':
      stream.readableHighWaterMark = 64 * 1024  // 64KB
  }
}
```

## 错误处理最佳实践

Streams 的错误处理需要特别注意，因为错误可能在异步链的任何位置发生：

```javascript
import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform } from 'node:stream'

// 正确的错误处理模式
async function processFile(inputPath, outputPath) {
  try {
    await pipeline(
      createReadStream(inputPath),
      new Transform({
        transform(chunk, encoding, callback) {
          try {
            const processed = processData(chunk)
            callback(null, processed)
          } catch (err) {
            callback(err)
          }
        }
      }),
      createWriteStream(outputPath)
    )
    console.log('File processed successfully')
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('Input file not found')
    } else if (err.code === 'EACCES') {
      console.error('Permission denied')
    } else {
      console.error('Stream processing failed:', err.message)
    }
    throw err
  }
}

// 资源清理：确保 streams 被正确关闭
async function processWithCleanup() {
  const readStream = createReadStream('input.bin')
  const writeStream = createWriteStream('output.bin')
  
  try {
    await pipeline(readStream, transformStream, writeStream)
  } finally {
    // pipeline 已经自动清理，但可以添加额外的清理逻辑
    console.log('Resources cleaned up')
  }
}
```

## Web Streams 与 Fetch 的集成

Node.js 26 让 Web Streams 与 Fetch API 的集成更加自然：

```javascript
// 流式处理 API 响应
async function streamApiResponse(url) {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  // 直接使用 ReadableStream 处理响应
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const text = decoder.decode(value, { stream: true })
    console.log('Received chunk:', text)
  }
}

// 流式上传文件
async function streamUpload(filePath, uploadUrl) {
  const { createReadStream } = await import('node:fs')
  const stream = createReadStream(filePath)
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: stream,  // Node.js ReadableStream 直接作为 body
    duplex: 'half'
  })
  
  return response.json()
}
```

## 实战：构建数据管道

结合 Node.js 26 的 Streams 特性，可以构建高效的数据处理管道：

```javascript
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform, pipeline } from 'node:stream'
import { promisify } from 'node:util'
import { createGzip, createGunzip } from 'node:zlib'

const pipelineAsync = promisify(pipeline)

// 构建可复用的数据处理管道
async function buildDataPipeline(inputPath, outputPath, options = {}) {
  const { compress = false, decompress = false } = options
  
  const transforms = []
  
  // 解压阶段
  if (decompress) {
    transforms.push(createGunzip())
  }
  
  // 数据处理阶段
  transforms.push(new Transform({
    transform(chunk, encoding, callback) {
      const lines = chunk.toString().split('\n')
      const processed = lines
        .filter(line => line.trim())
        .map(line => {
          const data = JSON.parse(line)
          return JSON.stringify({
            ...data,
            processedAt: Date.now()
          })
        })
        .join('\n')
      
      callback(null, processed + '\n')
    }
  }))
  
  // 压缩阶段
  if (compress) {
    transforms.push(createGzip())
  }
  
  // 组装管道
  await pipelineAsync(
    createReadStream(inputPath),
    ...transforms,
    createWriteStream(outputPath)
  )
  
  console.log('Pipeline completed successfully')
}

// 使用示例
await buildDataPipeline('raw-data.jsonl', 'processed-data.jsonl.gz', {
  compress: true
})
```

## 小结

Node.js 26 的 Streams 重构让 Node.js Streams 和 Web Streams 两套 API 实现了真正的互操作。异步迭代器的强化、背压处理的简化、以及与 Fetch API 的深度集成，让 Streams 编程变得更加直观和高效。在实际项目中，合理选择 highWaterMark、正确处理错误和资源清理、以及构建可复用的数据管道，是发挥 Streams 性能优势的关键。
