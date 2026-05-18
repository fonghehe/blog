---
title: "Node.js 12 新特性总结"
date: 2019-04-25 10:54:22
tags:
  - Node.js
readingTime: 1
description: "Node.js 12 上周发布（LTS 版本 10 月才锁定），带来了不少好东西。"
---

Node.js 12 上周发布（LTS 版本 10 月才锁定），带来了不少好东西。

## V8 7.4：更快的 JS 执行

- async/await 比之前快了约 10 倍（不再只是语法糖，底层有优化）
- 私有类字段支持（Chrome 74 同步发布的特性）

```javascript
// 私有字段（# 前缀）
class BankAccount {
  #balance = 0; // 外部无法访问

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

## TLS 1.3 默认支持

```javascript
const https = require("https");
const fs = require("fs");

const server = https.createServer({
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
  minVersion: "TLSv1.2", // 拒绝老旧 TLS
});
```

## ES Modules 实验支持（--experimental-modules）

```javascript
// package.json
{ "type": "module" }  // 文件默认当 ESM 处理

// 或用 .mjs 扩展名
// utils.mjs
export function add(a, b) { return a + b }

// main.mjs
import { add } from './utils.mjs'
console.log(add(1, 2))
```

Node 12 的 ESM 还是实验性的，不建议生产用。Node 14 才稳定。

## 堆内存限制提升

```bash
# Node 12 在 64 位系统上默认堆内存从 1.4GB 提升到 ~4GB
# 大型应用不用再手动设置
node --max-old-space-size=4096 app.js  # 以前需要这样
```

## 诊断报告

```bash
# 生成进程诊断报告（CPU、内存、文件句柄等）
node --experimental-report --report-on-signal app.js
kill -USR2 <pid>  # 触发报告
```

## 升级建议

- 从 Node 10 升级是安全的，API 基本兼容
- 在 CI 里同时测试 Node 10 和 12
- 等 10 月 12 变成 LTS 再大规模推到生产

## 小结

- async/await 性能大幅提升，放心用
- 私有类字段很实用，替代 `_` 约定的"私有"属性
- ESM 支持还是实验性，等 Node 14
- 堆内存提升，大型应用受益
