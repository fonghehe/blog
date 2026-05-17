---
title: "Node.js Stream pipeメカニズムの深掘り"
date: 2019-10-15 10:46:45
tags:
  - Node.js
readingTime: 4
description: "Node.js 的 Stream 是处理 I/O 数据流的核心抽象，而 `pipe` 方法是将多个流串联起来的关键 API。理解 pipe 的工作原理和背压（backpressure）机制，对于编写高性能的 Node.js 应用至关重要。"
---

Node.js 的 Stream 是处理 I/O 数据流的核心抽象，而 `pipe` 方法是将多个流串联起来的关键 API。理解 pipe 的工作原理和背压（backpressure）机制，对于编写高性能的 Node.js 应用至关重要。

## Streamの基礎おさらい

Node.js 中有四种基本的 Stream 类型：

```js
const { Readable, Writable, Duplex, Transform } = require('stream');

// Readable: 可读流（数据源）
// Writable: 可写流（数据目的地）
// Duplex: 双工流（可读可写，如 TCP socket）
// Transform: 转换流（可读可写，会转换数据，如 zlib 压缩）
```

## pipeメソッドの基本的な使い方

`pipe` 方法将可读流的数据导向可写流：

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

等价于手动处理的写法：

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

`pipe` 本质上帮你处理了这个复杂的流程。

## pipeのチェーン呼び出し

`pipe` 返回目标流，因此可以链式调用：

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

## バックプレッシャーの仕組み

背压是 Stream 中最重要的概念。当可写流的写入速度跟不上可读流的读取速度时，就会产生背压：

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

没有背压机制的话，快速读取的数据会在内存中不断堆积，最终导致 OOM（内存溢出）。`pipe` 会自动处理这个问题：

1. 当 `write()` 返回 `false` 时，`pipe` 暂停可读流
2. 当可写流触发 `drain` 事件时，`pipe` 恢复可读流

### pipe 的背压处理源码分析

`pipe` 的核心逻辑大致如下（简化版）：

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

## pipeのエラー処理

`pipe` 默认不会自动处理错误，也不会自动销毁流。需要手动处理：

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

从 Node.js 10 开始，`pipe` 支持 `{ end: false }` 选项，以及更好的错误传播：

```js
// { end: false } 不自动关闭目标流
readStream.pipe(writeStream, { end: false });
readStream.on('end', () => {
  // 手动追加尾部数据后再关闭
  writeStream.write('\n--- 文件结束 ---\n');
  writeStream.end();
});
```

推荐使用 `pipeline` 代替 `pipe`（Node.js 10+）：

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

`pipeline` 会自动处理错误、销毁流，避免内存泄漏。

## 実践：カスタムTransformストリーム

Transform 流是最灵活的流类型，可以对数据进行任意转换：

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

## 実践：HTTPプロキシストリーミング転送

在做 HTTP 代理时，流式处理可以大幅降低内存占用：

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

## 実践：バッチファイル処理

处理目录中的所有文件，逐个压缩：

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

## まとめ

- `pipe` 方法将可读流的数据导向可写流，自动处理背压
- 背压机制防止快速生产者压垮慢速消费者，避免内存溢出
- `pipe` 返回目标流，支持链式调用
- Node.js 10+ 推荐使用 `pipeline` 替代 `pipe`，自动处理错误和资源清理
- Transform 流可以对数据进行自定义转换
- 流式处理适合处理大文件、HTTP 代理、日志处理等场景
- 自定义流需要正确实现 `_transform` 和 `_flush` 方法
