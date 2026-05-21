---
title: "Node.js Stream実践ガイド"
date: 2019-05-19 16:51:01
tags:
  - Node.js
readingTime: 1
description: "StreamはNode.jsの最もコアなモジュールの一つですが、多くの開発者は日常的にファイル処理に`fs.readFile`しか使いません。大きなファイルの処理、パイプライン型のデータ処理の構築、効率的なI/Oの実現が必要な場合、Streamは欠かせないツールです。"
wordCount: 240
---

StreamはNode.jsの最もコアなモジュールの一つですが、多くの開発者は日常的にファイル処理に`fs.readFile`しか使いません。大きなファイルの処理、パイプライン型のデータ処理の構築、効率的なI/Oの実現が必要な場合、Streamは欠かせないツールです。

## なぜStreamが必要か

よくある問題を考えてみましょう：2GBのログファイルを読み込む。

```javascript
// 方法1：fs.readFile — 一度にすべてをメモリに読み込む
const fs = require("fs");

fs.readFile("./huge-log.txt", (err, data) => {
  if (err) throw err;
  console.log(data.length);
});

// 問題：2GBのファイルに2GBのメモリが必要——OOMの可能性大
```

```javascript
// 方法2：Stream — チャンクで読み込み、メモリ使用量は一定
const fs = require("fs");

const stream = fs.createReadStream("./huge-log.txt", {
  encoding: "utf8",
  highWaterMark: 64 * 1024, // 毎回64KBを読み込む
});

let totalSize = 0;
stream.on("data", (chunk) => {
  totalSize += chunk.length;
  // 一度に64KBしかメモリに乗らない
});

stream.on("end", () => {
  console.log("合計サイズ:", totalSize);
});

stream.on("error", (err) => {
  console.error("読み込みエラー:", err);
});
```

Streamはデータを小さなチャンクに分割して処理し、メモリ使用量をO(n)からO(1)に変えます。

## 4種類のStream

```javascript
const { Readable, Writable, Duplex, Transform } = require("stream");
```

### Readable（読み込みStream）

```javascript
const { Readable } = require("stream");

class CounterStream extends Readable {
  constructor(max) {
    super({ encoding: "utf8" });
    this.max = max;
    this.current = 1;
  }

  _read() {
    if (this.current > this.max) {
      this.push(null); // nullはStreamの終了を表す
      return;
    }
    this.push(`第 ${this.current} 行目\n`);
    this.current++;
  }
}

const counter = new CounterStream(5);
counter.pipe(process.stdout);
```

### Transform Stream

```javascript
const { Transform } = require("stream");

class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// パイプライン：ファイル読み込み → 大文字変換 → ファイル書き込み
const fs = require("fs");
fs.createReadStream("input.txt")
  .pipe(new UpperCaseTransform())
  .pipe(fs.createWriteStream("output.txt"));
```

## pipeline() — Streamをチェーンする安全な方法

```javascript
const { pipeline } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

async function processFile() {
  await pipelineAsync(
    fs.createReadStream("input.txt"),
    new UpperCaseTransform(),
    fs.createWriteStream("output.txt"),
  );
  // pipelineはエラー伝播とクリーンアップを自動処理
}
```

手動の`.pipe()`チェーンの代わりに`pipeline`を使いましょう——バックプレッシャーとエラーのクリーンアップを適切に処理します。
