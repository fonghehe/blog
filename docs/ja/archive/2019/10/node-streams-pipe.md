---
title: "Node.js Stream pipeメカニズムの深掘り"
date: 2019-10-15 10:46:45
tags:
  - Node.js
readingTime: 6
description: "Node.js 的 Stream 是处理 I/O 数据流的核心抽象，而 `pipe` 方法是将多个流串联起来的关键 API。理解 pipe 的工作原理和背压（backpressure）机制，对于编写高性能的 Node.js 应用至关重要。"
wordCount: 1071
---

Node.js の Stream は I/O データフローを扱う中核となる抽象であり、`pipe` メソッドは複数のストリームをつなぐ重要な API です。pipe の仕組みとバックプレッシャー（backpressure）の機構を理解することは、高性能な Node.js アプリケーションを書くために欠かせません。

## Streamの基礎おさらい

Node.js には 4 つの基本的な Stream 型があります：

```js
const { Readable, Writable, Duplex, Transform } = require('stream');

// Readable: 可读流（数据源）
// Writable: 可写流（数据目的地）
// Duplex: 双工流（可读可写，如 TCP socket）
// Transform: 转换流（可读可写，会转换数据，如 zlib 压缩）
```

## pipeメソッドの基本的な使い方

`pipe` メソッドは、読み取り可能ストリームのデータを行き先の書き込み可能ストリームへ流します：

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

これは手動で処理する書き方と同等です：

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

`pipe` は本質的に、この複雑な流れを代わりに処理してくれます。

## pipeのチェーン呼び出し

`pipe` は行き先のストリームを返すため、チェーンで呼び出せます：

```js
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

// 读取 → 压缩 → 加密 → 写入
fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())
  .pipe(crypto.createCipher('aes192', '密钥'))
  .pipe(fs.createWriteStream('output.txt.gz.enc'))
  .on('finish', () => console.log('処理完了'));
```

## バックプレッシャーの仕組み

バックプレッシャーは Stream の中で最も重要な概念です。書き込み可能ストリームの書き込み速度が読み取り可能ストリームの読み取り速度に追いつかないとき、バックプレッシャーが生じます：

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

バックプレッシャー機構がないと、高速に読み取ったデータがメモリ上にどんどん溜まり、最終的に OOM（メモリ不足）に至ります。`pipe` はこの問題を自動的に処理します：

1. 当 `write()` 返回 `false` 时，`pipe` 暂停可读流
2. 当可写流触发 `drain` 事件时，`pipe` 恢复可读流

### pipe 的背压处理源码分析

`pipe` の中核となるロジックは、概ね以下のようになります（簡略版）：

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

`pipe` はデフォルトではエラーを自動処理せず、ストリームも自動破棄しません。手動で処理する必要があります：

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

Node.js 10 以降、`pipe` は `{ end: false }` オプションと、より優れたエラー伝播をサポートしています：

```js
// { end: false } 不自动关闭目标流
readStream.pipe(writeStream, { end: false });
readStream.on('end', () => {
  // 手动追加尾部数据后再关闭
  writeStream.write('\n--- 文件结束 ---\n');
  writeStream.end();
});
```

`pipe` の代わりに `pipeline` の使用を推奨します（Node.js 10 以降）：

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

`pipeline` はエラーやストリームの破棄を自動処理し、メモリリークを防ぎます。

## 実践：カスタムTransformストリーム

Transform ストリームは最も柔軟なストリーム型であり、データを自由に変換できます：

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

// 使用例
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

HTTP プロキシを構築する際、ストリーミング処理によりメモリ使用量を大幅に抑えられます：

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

ディレクトリ内のすべてのファイルを一つずつ圧縮します：

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

- `pipe` メソッドは読み取り可能ストリームのデータを書き込み可能ストリームへ流し、バックプレッシャーを自動処理する
- バックプレッシャー機構は、高速な生産者が低速な消費者を圧迫するのを防ぎ、メモリ溢れを回避する
- `pipe` は行き先のストリームを返し、チェーン呼び出しをサポートする
- Node.js 10 以降では `pipe` の代わりに `pipeline` を使うことを推奨します。エラーとリソースの解放を自動処理します
- Transform ストリームはデータに対して独自の変換を行えます
- ストリーミング処理は、大容量ファイル、HTTP プロキシ、ログ処理などのシチュエーションに適しています
- 独自のストリームを実装するには、`_transform` と `_flush` メソッドを正しく実装する必要があります
