---
title: "Node.js 12 新特性總結：特性解讀與遷移建議"
date: 2019-04-25 10:54:22
tags:
  - Node.js
readingTime: 1
description: "Node.js 12 上週發佈（LTS 版本 10 月才鎖定），帶來了不少好東西。"
wordCount: 218
---

Node.js 12 上週發佈（LTS 版本 10 月才鎖定），帶來了不少好東西。

## V8 7.4：更快的 JS 執行

- async/await 比之前快了約 10 倍（不再隻是語法糖，底層有優化）
- 私有類字段支持（Chrome 74 同步發佈的特性）

```javascript
// 私有字段（# 前綴）
class BankAccount {
  #balance = 0; // 外部無法訪問

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

## TLS 1.3 默認支援

```javascript
const https = require("https");
const fs = require("fs");

const server = https.createServer({
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
  minVersion: "TLSv1.2", // 拒絕老舊 TLS
});
```

## ES Modules 實驗支援（--experimental-modules）

```javascript
// package.json
{ "type": "module" }  // 檔案默認當 ESM 處理

// 或用 .mjs 擴展名
// utils.mjs
export function add(a, b) { return a + b }

// main.mjs
import { add } from './utils.mjs'
console.log(add(1, 2))
```

Node 12 的 ESM 還是實驗性的，不建議生產用。Node 14 才穩定。

## 堆積內存限製提升

```bash
# Node 12 在 64 位系統上默認堆積內存從 1.4GB 提升到 ~4GB
# 大型應用不用再手動設置
node --max-old-space-size=4096 app.js  # 以前需要這樣
```

## 診斷報告

```bash
# 生成進程診斷報告（CPU、內存、檔案句柄等）
node --experimental-report --report-on-signal app.js
kill -USR2 <pid>  # 觸發報告
```

## 升級建議

- 從 Node 10 升級是安全的，API 基本兼容
- 在 CI 裏同時測試 Node 10 和 12
- 等 10 月 12 變成 LTS 再大規模推到生產

## 小結

- async/await 性能大幅提升，放心用
- 私有類字段很實用，替代 `_` 約定的"私有"屬性
- ESM 支持還是實驗性，等 Node 14
- 堆內存提升，大型應用受益
