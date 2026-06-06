---
title: "Node.js 22 Stream Processing API Upgrades and Best Practices"
date: 2026-06-06 09:36:54
tags:
  - Node.js
readingTime: 2
description: "Node.js 22 made important upgrades to stream processing APIs, including new ReadableStream/WritableStream standardization, backpressure handling improvements, and stream combinators. This article discusses new API usage and performance optimization strategies."
wordCount: 199
---

Node.js stream processing is the core capability for handling big data and I/O-intensive tasks. 2026's Node.js 22 brings important stream API updates, including full Web Streams API support, new stream combinators, and improved backpressure handling.

## Web Streams API vs Stream Module

Node.js 22 supports both stream APIs:

```javascript
// Traditional Node.js Stream
const { Readable, Transform } = require('node:stream');

// Web Streams API (browser compatible)
const { ReadableStream, TransformStream } = require('node:stream/web');
```

Web Streams advantages:
- **Browser compatible**: Same API runs in Node.js and browsers
- **Promise-based**: More natural with async/await
- **Standardized**: Follows W3C specification

Traditional Stream advantages:
- **Mature ecosystem**: More third-party library support
- **Finer backpressure control**: `highWaterMark` and `objectMode` more flexible
- **Backward compatible**: Many existing codebases depend on this API

## TransformStream Practice

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
      console.log('Compression complete');
    }
  });
}
```

## Backpressure Handling

Backpressure is the core problem in stream processing—what happens when producer speed exceeds consumer:

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

// pipe automatically handles backpressure
readable.pipe(writable);
```

## Stream Combinators

```javascript
const { pipeline } = require('node:stream/promises');
const { createGzip } = require('node:zlib');

// Use pipeline to safely combine multiple streams
async function compressFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    createGzip({ level: 6 }),
    fs.createWriteStream(outputPath)
  );
  console.log('Compression complete');
}
```

`pipeline` automatically handles error propagation and resource cleanup, safer than `pipe`.

## Async Iterators and Streams

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
      console.log(`Line ${lineCount}: ${line}`);
    }
  }
  console.log(`Total ${lineCount} lines`);
}
```

Async iterator advantages:
- **Memory friendly**: Line-by-line processing, no full file loading
- **Clear code**: for-await-of syntax is intuitive
- **Error handling**: try-catch naturally integrated

## Summary

Node.js 22's stream processing API is more modern and safer. Web Streams API provides browser compatibility, pipeline provides safe stream combination, async iterators provide intuitive consumption. 2026's stream processing principles: use pipeline to combine streams, use AbortController to manage cancellation, use async iterators to consume big data.
