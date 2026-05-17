---
title: "Node.js 12の新機能まとめ"
date: 2019-04-25 10:54:22
tags:
  - Node.js
readingTime: 1
description: "Node.js 12が先週リリースされました（LTSバージョンのロックは10月の予定）。多くの良い機能が追加されています。"
---

Node.js 12が先週リリースされました（LTSバージョンのロックは10月の予定）。多くの良い機能が追加されています。

## V8 7.4：より速いJS実行

- async/awaitが以前より約10倍高速化（単なる糖衣構文ではなく、エンジンレベルでの最適化）
- プライベートクラスフィールドのサポート（Chrome 74と同時リリース）

```javascript
// プライベートフィールド（#プレフィックス）
class BankAccount {
  #balance = 0; // 外部からアクセス不可

  deposit(amount) {
    this.#balance += amount;
  }

  get balance() {
    return this.#balance;
  }
}

const account = new BankAccount();
account.deposit(1000);
console.log(account.balance); // 1000
console.log(account.#balance); // SyntaxError！
```

## TLS 1.3のデフォルト対応

```javascript
const https = require("https");
const fs = require("fs");

const server = https.createServer({
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
  minVersion: "TLSv1.2", // 古いTLSを拒否
});
```

## ESモジュールの実験的サポート（--experimental-modules）

```javascript
// package.json
{ "type": "module" }  // ファイルをデフォルトでESMとして処理

// または .mjs 拡張子を使用
// utils.mjs
export function add(a, b) { return a + b }

// main.mjs
import { add } from './utils.mjs'
console.log(add(1, 2))
```

Node 12のESMはまだ実験的であり、本番環境での使用は推奨されません。安定版はNode 14からです。

## ヒープメモリ制限の引き上げ

```bash
# 64ビットシステムでNode 12のデフォルトヒープは1.4GBから約4GBに増加
# 大規模アプリケーションで手動設定が不要に
node --max-old-space-size=4096 app.js  # 以前は必要だった設定
```

## 診断レポート

```bash
# プロセスの診断レポート生成（CPU・メモリ・ファイルハンドルなど）
node --experimental-report --report-on-signal app.js
kill -USR2 <pid>  # レポートのトリガー
```
