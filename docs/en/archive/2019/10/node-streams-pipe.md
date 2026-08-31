---
title: "Node.js Stream pipe Mechanism In Depth"
date: 2019-10-15 10:46:45
tags:
  - Node.js
readingTime: 4
description: "Node.js Streams are the core abstraction for handling I/O data flows, and the `pipe` method is the key API for chaining multiple streams together. Understanding how `pipe` works—and the backpressure mechanism—is essential for writing high-performance Node.js applications."
wordCount: 380
---

Node.js Streams are the core abstraction for handling I/O data flows, and the `pipe` method is the key API for chaining multiple streams together. Understanding how `pipe` works—and the backpressure mechanism—is essential for writing high-performance Node.js applications.

## Stream Basics Review

Node.js has four basic stream types:

```js
const { Readable, Writable, Duplex, Transform } = require('stream');

// Readable: 可读流（数据源）
// Writable: 可写流（数据目的地）
// Duplex: 双工流（可读可写，如 TCP socket）
// Transform: 转换流（可读可写，会转换数据，如 zlib 压缩）
```

## pipe Method Basic Usage

The `pipe` method directs data from a readable stream into a writable stream:

```js
const fs = require('fs');

// 最基本的用法：文件复制
const readStream = fs.createReadStream('source.txt');
const writeStream = fs.createWriteStream('destination.txt');

readStream.pipe(writeStream);

writeStream.on('finish', () => {
  console.log('文件复制完成');
});
```

This is equivalent to handling it manually:

```js
readStream.on('data', (chunk) => {
  const canWrite = writeStream.write(chunk);
  if (!canWrite) {
    readStream.pause();
    writeStream.once('drain', () => readStream.resume());
  }
});

readStream.on('end', () => writeStream.end());
```

Under the hood, `pipe` handles exactly this complex flow for you.

## Chaining pipe Calls

`pipe` returns the destination stream, so you can chain calls:

```js
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

// 读取 → 压缩 → 加密 → 写入
fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())
  .pipe(crypto.createCipher('aes192', '密钥'))
  .pipe(fs.createWriteStream('output.txt.gz.enc'))
  .on('finish', () => console.log('处理完成'));
```

## Backpressure Mechanism

Backpressure is the most important concept in Streams. It occurs when the writable stream can't keep up with the rate at which the readable stream produces data:

```js
const { Readable, Writable } = require('stream');

// 模拟一个快速的可读流
const fastReader = new Readable({
  read() {
    // 每次推入 1MB 数据
    this.push(Buffer.alloc(1024 * 1024));
  }
});

// 模拟一个慢速的可写流
const slowWriter = new Writable({
  write(chunk, encoding, callback) {
    // 模拟慢速写入，每次延迟 100ms
    setTimeout(() => {
      console.log(`写入了 ${chunk.length} 字节`);
      callback();
    }, 100);
  }
});

// pipe 会自动处理背压！
fastReader.pipe(slowWriter);
```

Without backpressure, data read quickly would keep piling up in memory and eventually cause an OOM (out-of-memory) error. `pipe` handles this automatically:

1. When `write()` returns `false`, `pipe` pauses the readable stream
2. When the writable stream emits a `drain` event, `pipe` resumes the readable stream

### Source-Level Look at How `pipe` Handles Backpressure

The core logic of `pipe` looks roughly like this (simplified):

```js
function pipe(src, dest, endFn) {
  let drained = true;

  // 监听可读流的 data 事件
  src.on('data', (chunk) => {
    const canContinue = dest.write(chunk);
    if (!canContinue) {
      drained = false;
      src.pause();  // 暂停读取，等待 drain
    }
  });

  // 监听可写流的 drain 事件
  dest.on('drain', () => {
    drained = true;
    src.resume();  // 恢复读取
  });

  // 监听可读流的 end 事件
  src.on('end', () => {
    if (endFn !== false) dest.end();
  });
}
```

## Error Handling in pipe

By default, `pipe` doesn't handle errors or destroy streams automatically—you have to do that yourself:

```js
const fs = require('fs');

const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

readStream.pipe(writeStream);

// 必须监听错误
readStream.on('error', (err) => {
  console.error('读取错误:', err);
  writeStream.end();
});

writeStream.on('error', (err) => {
  console.error('写入错误:', err);
  readStream.destroy();
});
```

Starting with Node.js 10, `pipe` supports the `{ end: false }` option as well as better error propagation:

```js
// { end: false } 不自动关闭目标流
readStream.pipe(writeStream, { end: false });
readStream.on('end', () => {
  // 手动追加尾部数据后再关闭
  writeStream.write('\n--- 文件结束 ---\n');
  writeStream.end();
});
```

It's recommended to use `pipeline` instead of `pipe` (Node.js 10+):

```js
const { pipeline } = require('stream');
const fs = require('fs');
const zlib = require('zlib');

pipeline(
  fs.createReadStream('input.txt'),
  zlib.createGzip(),
  fs.createWriteStream('output.txt.gz'),
  (err) => {
    if (err) {
      console.error('Pipeline 失败:', err);
    } else {
      console.log('Pipeline 完成');
    }
  }
);
```

`pipeline` handles errors and destroys streams automatically, avoiding memory leaks.

## In Practice: Custom Transform Stream

Transform streams are the most flexible type—they can transform data however you like:

```js
const { Transform } = require('stream');

// CSV 行转换为 JSON 对象
class CsvToJsonTransform extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
    this.headers = null;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // 将新数据追加到缓冲区
    this.buffer += chunk.toString();

    // 按行分割
    const lines = this.buffer.split('\n');
    // 保留最后一行（可能不完整）
    this.buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;

      const values = line.split(',').map(v => v.trim());

      if (!this.headers) {
        this.headers = values;
        continue;
      }

      const obj = {};
      this.headers.forEach((header, index) => {
        let value = values[index] || '';
        // 尝试转换数字
        if (!isNaN(value) && value !== '') {
          value = Number(value);
        }
        obj[header] = value;
      });

      this.push(JSON.stringify(obj));
    }

    callback();
  }

  _flush(callback) {
    // 处理缓冲区中剩余的数据
    if (this.buffer.trim() && this.headers) {
      const values = this.buffer.split(',').map(v => v.trim());
      const obj = {};
      this.headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      this.push(JSON.stringify(obj));
    }
    callback();
  }
}

// 使用
const fs = require('fs');
const { pipeline } = require('stream');

pipeline(
  fs.createReadStream('data.csv'),
  new CsvToJsonTransform(),
  fs.createWriteStream('data.json'),
  (err) => {
    if (err) console.error(err);
    else console.log('CSV 转换完成');
  }
);
```

## In Practice: HTTP Proxy Streaming

When building an HTTP proxy, streaming can greatly reduce memory usage:

```js
const http = require('http');
const https = require('https');
const { pipeline } = require('stream');

const server = http.createServer((clientReq, clientRes) => {
  const targetUrl = new URL(clientReq.url, 'http://target-server.com');

  const proxyReq = http.request({
    hostname: targetUrl.hostname,
    port: targetUrl.port,
    path: targetUrl.pathname + targetUrl.search,
    method: clientReq.method,
    headers: clientReq.headers,
  }, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    // 流式转发响应体
    pipeline(proxyRes, clientRes, (err) => {
      if (err) console.error('代理响应失败:', err);
    });
  });

  // 流式转发请求体
  pipeline(clientReq, proxyReq, (err) => {
    if (err) console.error('代理请求失败:', err);
  });

  proxyReq.on('error', (err) => {
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
  });
});

server.listen(8080, () => {
  console.log('代理服务器运行在 http://localhost:8080');
});
```

## In Practice: Batch File Processing

To compress every file in a directory, one at a time:

```js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

async function compressFile(inputPath) {
  const outputPath = inputPath + '.gz';

  await pipelineAsync(
    fs.createReadStream(inputPath),
    zlib.createGzip(),
    fs.createWriteStream(outputPath)
  );

  console.log(`已压缩: ${path.basename(inputPath)}`);
}

async function compressDir(dirPath) {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && !file.endsWith('.gz')) {
      await compressFile(fullPath);
    }
  }
}

compressDir('./data').catch(console.error);
```

## Summary

- The `pipe` method directs data from a readable stream into a writable stream and handles backpressure automatically
- The backpressure mechanism prevents a fast producer from overwhelming a slow consumer, avoiding out-of-memory errors
- `pipe` returns the destination stream, so calls can be chained
- On Node.js 10+, prefer `pipeline` over `pipe`—it handles errors and resource cleanup automatically
- Transform streams let you apply custom transformations to the data
- Streaming fits scenarios like large files, HTTP proxies, and log processing
- Custom streams must correctly implement the `_transform` and `_flush` methods
