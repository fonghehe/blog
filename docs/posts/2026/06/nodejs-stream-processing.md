---
title: "Node.js 22 流处理 API 升级与最佳实践"
date: 2026-06-06 09:36:54
tags:
  - Node.js
  - Stream
readingTime: 3
description: "Node.js 22 对流处理 API 进行了重要升级，包括新的 ReadableStream/WritableStream 标准化、背压处理改进和流组合器。本文讨论新 API 的用法和性能优化策略。"
wordCount: 567
---

Node.js 的流处理是处理大数据和 I/O 密集型任务的核心能力。2026 年的 Node.js 22 带来了流 API 的重要更新，包括 Web Streams API 的完全支持、新的流组合器和改进的背压处理。

## Web Streams API vs Stream 模块

Node.js 22 同时支持两种流 API：

```javascript
// 传统 Node.js Stream
const { Readable, Transform } = require('node:stream');

// Web Streams API（浏览器兼容）
const { ReadableStream, TransformStream } = require('node:stream/web');
```

Web Streams 的优势：
- **浏览器兼容**：相同的 API 可以在 Node.js 和浏览器中运行
- **Promise-based**：使用 async/await 更自然
- **标准化**：遵循 W3C 规范

传统 Stream 的优势：
- **生态成熟**：更多的第三方库和工具支持
- **背压处理更精细**：`highWaterMark` 和 `objectMode` 控制更灵活
- **向后兼容**：大量现有代码依赖此 API

## TransformStream 实战

TransformStream 是处理数据转换的核心。一个实际的例子——图片压缩流：

```javascript
const { TransformStream } = require('node:stream/web');

async function createImageCompressor(options = {}) {
  const { quality = 80 } = options;

  return new TransformStream({
    async transform(chunk, controller) {
      // 假设 chunk 是 Buffer
      const compressed = await compressImage(chunk, quality);
      controller.enqueue(compressed);
    },
    flush(controller) {
      // 流结束时的清理工作
      console.log('压缩完成');
    }
  });
}

// 使用
async function processImages(inputStream) {
  const compressor = await createImageCompressor({ quality: 75 });
  const writer = fs.createWriteStream('output.jpg');

  await inputStream
    .pipeThrough(compressor)
    .pipeTo(writer);
}
```

## 背压处理

背压是流处理中的核心问题——生产者速度超过消费者时会发生什么：

```javascript
const { Readable, Writable } = require('node:stream');

// 创建可读流
const readable = Readable.from(async function* () {
  for (let i = 0; i < 1000000; i++) {
    yield Buffer.from(`line ${i}\n`);
  }
}());

// 创建可写流
const writable = new Writable({
  write(chunk, encoding, callback) {
    // 模拟慢速处理
    setTimeout(() => {
      process.stdout.write(chunk);
      callback();
    }, 10);
  }
});

// pipe 会自动处理背压
readable.pipe(writable);
```

手动控制背压：

```javascript
const readable = getReadableStream();

readable.on('data', (chunk) => {
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    readable.pause();  // 暂停读取
    writable.once('drain', () => {
      readable.resume();  // 恢复读取
    });
  }
});
```

## Stream 组合器

2026 年的 Node.js 提供了更强大的流组合能力：

```javascript
const { pipeline } = require('node:stream/promises');
const { createGzip, createBrotliCompress } = require('node:zlib');

// 使用 pipeline 安全地组合多个流
async function compressFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    createGzip({ level: 6 }),
    fs.createWriteStream(outputPath)
  );
  console.log('压缩完成');
}

// 错误处理
try {
  await compressFile('large.txt', 'large.txt.gz');
} catch (err) {
  console.error('压缩失败:', err);
}
```

`pipeline` 自动处理错误传播和资源清理，比 `pipe` 更安全。

## 异步迭代器与流

异步迭代器让流的消费更直观：

```javascript
const fs = require('node:fs');
const readline = require('node:readline');

async function processLargeFile(filePath) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('error')) {
      console.log(`行 ${lineCount}: ${line}`);
    }
  }
  console.log(`总共 ${lineCount} 行`);
}
```

异步迭代器的优势：
- **内存友好**：逐行处理，不会加载整个文件
- **代码清晰**：for-await-of 语法直观
- **错误处理**：try-catch 自然集成

## Worker Threads 与流

对于 CPU 密集型的流处理，可以结合 Worker Threads：

```javascript
const { Worker } = require('node:worker_threads');
const { ReadableStream } = require('node:stream/web');

function createWorkerPool(size) {
  const workers = [];
  const available = [];

  for (let i = 0; i < size; i++) {
    const worker = new Worker('./worker.js');
    workers.push(worker);
    available.push(worker);
  }

  return {
    async process(chunk) {
      const worker = available.pop();
      const result = await new Promise((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
        worker.postMessage(chunk);
      });
      available.push(worker);
      return result;
    },
    terminate() {
      workers.forEach(w => w.terminate());
    }
  };
}
```

## 流的错误处理

流错误处理是常见痛点。最佳实践：

```javascript
const { pipeline } = require('node:stream/promises');

async function safeStreamProcessing() {
  const controller = new AbortController();

  try {
    await pipeline(
      createReadStream('input.txt'),
      new TransformStream({
        transform(chunk, controller) {
          try {
            const processed = processChunk(chunk);
            controller.enqueue(processed);
          } catch (err) {
            controller.error(err);  // 显式传播错误
          }
        }
      }),
      createWriteStream('output.txt'),
      { signal: controller.signal }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('流处理被取消');
    } else {
      console.error('流处理失败:', err);
    }
  }
}
```

## 性能监控

流处理的性能监控需要关注几个指标：

```javascript
const { Readable } = require('node:stream');

function monitorStream(stream, name) {
  let bytesRead = 0;
  const startTime = Date.now();

  stream.on('data', (chunk) => {
    bytesRead += chunk.length;
  });

  stream.on('end', () => {
    const duration = Date.now() - startTime;
    const throughput = (bytesRead / duration / 1024).toFixed(2);
    console.log(`${name}: ${bytesRead} bytes, ${duration}ms, ${throughput} KB/s`);
  });

  return stream;
}
```

关键监控指标：
- **吞吐量**：每秒处理的数据量
- **内存使用**：流处理时的内存峰值
- **背压频率**：消费者跟不上生产者的次数

## 小结

Node.js 22 的流处理 API 更现代、更安全。Web Streams API 提供浏览器兼容性，pipeline 提供安全的流组合，异步迭代器提供直观的消费方式。2026 年的流处理原则：用 pipeline 组合流，用 AbortController 管理取消，用异步迭代器消费大数据。背压处理仍然重要，但现代 API 让这变得更简单。
