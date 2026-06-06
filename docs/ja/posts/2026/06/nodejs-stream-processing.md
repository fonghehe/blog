---
title: "Node.js 22 ストリーム処理 API アップグレードとベストプラクティス"
date: 2026-06-06 09:36:54
tags:
  - Node.js
readingTime: 2
description: "Node.js 22 はストリーム処理 API を重要なアップグレードし、新しい ReadableStream/WritableStream の標準化、背圧処理の改善、ストリームコンビネータを含む。新しい API の使用法とパフォーマンス最適化戦略を議論する。"
wordCount: 376
---

Node.js のストリーム処理はビッグデータと I/O 集約型タスクを処理するコア能力だ。2026 年の Node.js 22 は Web Streams API の完全サポート、新しいストリームコンビネータ、改善された背圧処理を含む重要なストリーム API 更新をもたらす。

## Web Streams API vs Stream モジュール

Node.js 22 は両方のストリーム API をサポート：

```javascript
// 従来の Node.js Stream
const { Readable, Transform } = require('node:stream');

// Web Streams API（ブラウザ互換）
const { ReadableStream, TransformStream } = require('node:stream/web');
```

Web Streams の利点：
- **ブラウザ互換**：同じ API が Node.js とブラウザで動作
- **Promise ベース**：async/await でより自然
- **標準化**：W3C 仕様に準拠

## TransformStream 実践

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
      console.log('圧縮完了');
    }
  });
}
```

## 背圧処理

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

// pipe は背圧を自動処理
readable.pipe(writable);
```

## ストリームコンビネータ

```javascript
const { pipeline } = require('node:stream/promises');
const { createGzip } = require('node:zlib');

async function compressFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    createGzip({ level: 6 }),
    fs.createWriteStream(outputPath)
  );
  console.log('圧縮完了');
}
```

`pipeline` はエラー伝播とリソースクリーンアップを自動的に処理し、`pipe` より安全だ。

## 非同期イテレーターとストリーム

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
  console.log(`合計 ${lineCount} 行`);
}
```

## まとめ

Node.js 22 のストリーム処理 API はよりモダンで安全になった。Web Streams API はブラウザ互換性を提供し、pipeline は安全なストリーム組み合わせを提供し、非同期イテレーターは直感的な消費方法を提供する。2026 年のストリーム処理原則：pipeline でストリームを組み合わせ、AbortController でキャンセルを管理し、非同期イテレーターでビッグデータを消費する。
