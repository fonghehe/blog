---
title: "Node.js Stream pipe 機制深入"
date: 2019-10-15 10:46:45
tags:
  - Node.js
readingTime: 4
description: "Node.js 的 Stream 是處理 I/O 數據流的核心抽象，而 `pipe` 方法是將多個流串聯起來的關鍵 API。理解 pipe 的工作原理和背壓（backpressure）機制，對於編寫高性能的 Node.js 應用至關重要。"
wordCount: 595
---

Node.js 的 Stream 是處理 I/O 數據流的核心抽象，而 `pipe` 方法是將多個流串聯起來的關鍵 API。理解 pipe 的工作原理和背壓（backpressure）機制，對於編寫高性能的 Node.js 應用至關重要。

## Stream 基礎回顧

Node.js 中有四種基本的 Stream 類型：

```js
const { Readable, Writable, Duplex, Transform } = require('stream');

// Readable: 可讀流（數據源）
// Writable: 可寫流（數據目的地）
// Duplex: 雙工流（可讀可寫，如 TCP socket）
// Transform: 轉換流（可讀可寫，會轉換數據，如 zlib 壓縮）
```

## pipe 方法基礎用法

`pipe` 方法將可讀流的數據導向可寫流：

```js
const fs = require('fs');

// 最基本的用法：文件複製
const readStream = fs.createReadStream('source.txt');
const writeStream = fs.createWriteStream('destination.txt');

readStream.pipe(writeStream);

writeStream.on('finish', () => {
  console.log('文件複製完成');
});
```

等價於手動處理的寫法：

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

`pipe` 本質上幫你處理了這個複雜的流程。

## pipe 的鏈式調用

`pipe` 返回目標流，因此可以鏈式調用：

```js
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

// 讀取 → 壓縮 → 加密 → 寫入
fs.createReadStream('input.txt')
  .pipe(zlib.createGzip())
  .pipe(crypto.createCipher('aes192', '密鑰'))
  .pipe(fs.createWriteStream('output.txt.gz.enc'))
  .on('finish', () => console.log('處理完成'));
```

## 背壓（Backpressure）機制

背壓是 Stream 中最重要的概念。當可寫流的寫入速度跟不上可讀流的讀取速度時，就會產生背壓：

```js
const { Readable, Writable } = require('stream');

// 模擬一個快速的可讀流
const fastReader = new Readable({
  read() {
    // 每次推入 1MB 數據
    this.push(Buffer.alloc(1024 * 1024));
  }
});

// 模擬一個慢速的可寫流
const slowWriter = new Writable({
  write(chunk, encoding, callback) {
    // 模擬慢速寫入，每次延遲 100ms
    setTimeout(() => {
      console.log(`寫入了 ${chunk.length} 字節`);
      callback();
    }, 100);
  }
});

// pipe 會自動處理背壓！
fastReader.pipe(slowWriter);
```

沒有背壓機制的話，快速讀取的數據會在內存中不斷堆積，最終導致 OOM（內存溢出）。`pipe` 會自動處理這個問題：

1. 當 `write()` 返回 `false` 時，`pipe` 暫停可讀流
2. 當可寫流觸發 `drain` 事件時，`pipe` 恢復可讀流

### pipe 的背壓處理源碼分析

`pipe` 的核心邏輯大致如下（簡化版）：

```js
function pipe(src, dest, endFn) {
  let drained = true;

  // 監聽可讀流的 data 事件
  src.on('data', (chunk) => {
    const canContinue = dest.write(chunk);
    if (!canContinue) {
      drained = false;
      src.pause();  // 暫停讀取，等待 drain
    }
  });

  // 監聽可寫流的 drain 事件
  dest.on('drain', () => {
    drained = true;
    src.resume();  // 恢復讀取
  });

  // 監聽可讀流的 end 事件
  src.on('end', () => {
    if (endFn !== false) dest.end();
  });
}
```

## pipe 的錯誤處理

`pipe` 默認不會自動處理錯誤，也不會自動銷燬流。需要手動處理：

```js
const fs = require('fs');

const readStream = fs.createReadStream('input.txt');
const writeStream = fs.createWriteStream('output.txt');

readStream.pipe(writeStream);

// 必須監聽錯誤
readStream.on('error', (err) => {
  console.error('讀取錯誤:', err);
  writeStream.end();
});

writeStream.on('error', (err) => {
  console.error('寫入錯誤:', err);
  readStream.destroy();
});
```

從 Node.js 10 開始，`pipe` 支持 `{ end: false }` 選項，以及更好的錯誤傳播：

```js
// { end: false } 不自動關閉目標流
readStream.pipe(writeStream, { end: false });
readStream.on('end', () => {
  // 手動追加尾部數據後再關閉
  writeStream.write('\n
--- 文件結束 ---\n');
  writeStream.end();
});
```

推薦使用 `pipeline` 代替 `pipe`（Node.js 10+）：

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
      console.error('Pipeline 失敗:', err);
    } else {
      console.log('Pipeline 完成');
    }
  }
);
```

`pipeline` 會自動處理錯誤、銷燬流，避免內存泄漏。

## 實戰：自定義 Transform 流

Transform 流是最靈活的流類型，可以對數據進行任意轉換：

```js
const { Transform } = require('stream');

// CSV 行轉換為 JSON 對象
class CsvToJsonTransform extends Transform {
  constructor(options) {
    super({ ...options, objectMode: true });
    this.headers = null;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // 將新數據追加到緩衝區
    this.buffer += chunk.toString();

    // 按行分割
    const lines = this.buffer.split('\n');
    // 保留最後一行（可能不完整）
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
        // 嘗試轉換數字
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
    // 處理緩衝區中剩餘的數據
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
    else console.log('CSV 轉換完成');
  }
);
```

## 實戰：HTTP 代理流式轉發

在做 HTTP 代理時，流式處理可以大幅降低內存佔用：

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
    // 流式轉發響應體
    pipeline(proxyRes, clientRes, (err) => {
      if (err) console.error('代理響應失敗:', err);
    });
  });

  // 流式轉發請求體
  pipeline(clientReq, proxyReq, (err) => {
    if (err) console.error('代理請求失敗:', err);
  });

  proxyReq.on('error', (err) => {
    clientRes.writeHead(502);
    clientRes.end('Bad Gateway');
  });
});

server.listen(8080, () => {
  console.log('代理服務器運行在 http://localhost:8080');
});
```

## 實戰：批量文件處理

處理目錄中的所有文件，逐個壓縮：

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

  console.log(`已壓縮: ${path.basename(inputPath)}`);
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

## 小結

- `pipe` 方法將可讀流的數據導向可寫流，自動處理背壓
- 背壓機制防止快速生產者壓垮慢速消費者，避免內存溢出
- `pipe` 返回目標流，支持鏈式調用
- Node.js 10+ 推薦使用 `pipeline` 替代 `pipe`，自動處理錯誤和資源清理
- Transform 流可以對數據進行自定義轉換
- 流式處理適合處理大文件、HTTP 代理、日誌處理等場景
- 自定義流需要正確實現 `_transform` 和 `_flush` 方法
