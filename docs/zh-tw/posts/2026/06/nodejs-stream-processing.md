---
title: "Node.js 22 串流處理 API 升級與最佳實踐"
date: 2026-06-06 09:36:54
tags:
  - Node.js
readingTime: 1
description: "Node.js 22 對串流處理 API 進行了重要升級，包括新的 ReadableStream/WritableStream 標準化、背壓處理改進和串流組合器。本文討論新 API 的用法和效能最佳化策略。"
wordCount: 234
---

Node.js 的串流處理是處理大資料和 I/O 密集型任務的核心能力。2026 年的 Node.js 22 帶來了串流 API 的重要更新，包括 Web Streams API 的完全支援、新的串流組合器和改進的背壓處理。

## Web Streams API vs Stream 模組

Node.js 22 同時支援兩種串流 API：

```javascript
// 傳統 Node.js Stream
const { Readable, Transform } = require('node:stream');

// Web Streams API（瀏覽器相容）
const { ReadableStream, TransformStream } = require('node:stream/web');
```

Web Streams 的優勢：
- **瀏覽器相容**：相同的 API 可以在 Node.js 和瀏覽器中執行
- **Promise-based**：使用 async/await 更自然
- **標準化**：遵循 W3C 規範

## TransformStream 實戰

```javascript
const { TransformStream } = require('node:stream/web');

async function createImageCompressor(options = {}) {
  const { quality = 80 } = options;

  return new TransformStream({
    async transform(chunk, controller) {
      const compressed = await compressImage(chunk, quality);
      controller.enqueue(compressed);
    },
    flush(controller) {
      console.log('壓縮完成');
    }
  });
}
```

## 背壓處理

```javascript
const { Readable, Writable } = require('node:stream');

const readable = Readable.from(async function* () {
  for (let i = 0; i < 1000000; i++) {
    yield Buffer.from(`line ${i}\n`);
  }
}());

const writable = new Writable({
  write(chunk, encoding, callback) {
    setTimeout(() => {
      process.stdout.write(chunk);
      callback();
    }, 10);
  }
});

// pipe 會自動處理背壓
readable.pipe(writable);
```

## 串流組合器

```javascript
const { pipeline } = require('node:stream/promises');
const { createGzip } = require('node:zlib');

async function compressFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    createGzip({ level: 6 }),
    fs.createWriteStream(outputPath)
  );
  console.log('壓縮完成');
}
```

## 異步迭代器與串流

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
  console.log(`總共 ${lineCount} 行`);
}
```

## 小結

Node.js 22 的串流處理 API 更現代、更安全。Web Streams API 提供瀏覽器相容性，pipeline 提供安全的串流組合，異步迭代器提供直觀的消費方式。2026 年的串流處理原則：用 pipeline 組合串流，用 AbortController 管理取消，用異步迭代器消費大資料。
