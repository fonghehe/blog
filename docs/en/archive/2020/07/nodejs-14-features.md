---
title: "How Node.js 14 New Features Affect Frontend Development"
date: 2020-07-07 10:40:44
tags:
  - JavaScript
readingTime: 2
description: "Node.js 14 enters LTS with V8 8.1, bringing practical new features that directly impact frontend build tools and scripts."
wordCount: 125
---

Node.js 14 has entered its LTS phase, upgrading the V8 engine to 8.1 and bringing several practical new features. As frontend engineers, these changes directly affect our build tools and scripts.

## Optional Chaining and Nullish Coalescing Natively Supported in Node.js

```javascript
// 不需要 --harmony 标志了！
// Node.js 14 直接支持

// 可选链
const config = {
  database: {
    host: "localhost",
  },
};

const port = config?.database?.port ?? 3306;
console.log(port); // 3306

// 空值合并
const timeout = process.env.TIMEOUT ?? 5000;

// 实际场景：处理 API 响应
function processResponse(response) {
  const users = response?.data?.users ?? [];
  const total = response?.data?.total ?? 0;
  return { users, total };
}
```

## Top-level await

```javascript
// 以前：必须包在 async 函数里
async function main() {
  const config = await loadConfig();
  const db = await connectDB(config);
  // ...
}
main();

// Node.js 14：顶层 await
// config.mjs
const config = await import("./config.json");
const response = await fetch("https://api.example.com/data");
const data = await response.json();

console.log("配置加载完成:", config);
console.log("数据获取完成:", data);

// 注意：只能在 .mjs 或 package.json 中 type: "module" 的文件中使用
```

```json
// package.json 启用 ESM
{
  "type": "module"
}
```

## Intl.DisplayNames: Localized Name Display

```javascript
// 以前需要一个映射表
const langMap = { zh: "中文", en: "English", ja: "日本語" };

// Node.js 14：内置 API
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("CN")); // 中国
console.log(regionNames.of("US")); // 美国

const langNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(langNames.of("zh")); // 中文
console.log(langNames.of("en")); // 英语

// 实际场景：国际化表单中的国家选择
function getCountryOptions(locale = "zh") {
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  return ["CN", "US", "JP", "KR", "GB"].map((code) => ({
    value: code,
    label: regionNames.of(code),
  }));
}
// [{ value: 'CN', label: '中国' }, { value: 'US', label: '美国' }, ...]
```

## Cleaner Stack Traces

```javascript
// Node.js 14 的错误堆栈更清晰
// 以前会显示一些无用的 internal/frames

function inner() {
  throw new Error("Something went wrong");
}

function middle() {
  inner();
}

function outer() {
  middle();
}

outer();
// Error: Something went wrong
//     at inner (file:///app/test.js:2:9)
//     at middle (file:///app/test.js:6:3)
//     at outer (file:///app/test.js:10:3)
// 干净多了，没有 internal 的噪音
```

## Stream Performance Improvements

```javascript
// readable.iterator() 支持 for-await-of
import { createReadStream } from "fs";
import { createInterface } from "readline";

async function processLargeFile(filePath) {
  const stream = createReadStream(filePath);
  const rl = createInterface({ input: stream });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    // 逐行处理大文件，不会 OOM
    if (line.includes("ERROR")) {
      console.error(`第 ${lineCount} 行发现错误: ${line}`);
    }
  }

  return lineCount;
}
```

## Impact on the Frontend Toolchain

```javascript
// Webpack 5 要求 Node.js >= 10.13.0，14 完全兼容
// Vite 要求 Node.js >= 12.0.0，14 完全兼容
// TypeScript 4.0 支持 Node.js 14

// esbuild 最佳性能在 Node.js 14 上
// Deno 兼容性层需要 Node.js 14+

// 检查版本的脚本
// scripts/check-node.js
const semver = require("semver");
const required = ">=14.0.0";

if (!semver.satisfies(process.version, required)) {
  console.error(`需要 Node.js ${required}，当前版本 ${process.version}`);
  process.exit(1);
}

console.log(`Node.js ${process.version} ✓`);
```

## Upgrade Notes

```bash
# 推荐用 nvm 管理 Node.js 版本
nvm install 14
nvm use 14

# 检查破坏性变更
# 1. 一些废弃的 API 被移除了
# 2. URL.parse() 被废弃，用 new URL() 替代
# 3. 一些 Buffer 方法被废弃

# CI 配置更新
# .github/workflows/ci.yml
- uses: actions/setup-node@v2
  with:
    node-version: '14'
```

## Summary

- Optional chaining and nullish coalescing are natively supported in Node.js, so you can use them in build scripts too.
- Top-level await simplifies the async initialization code in ESM modules.
- Intl.DisplayNames provides built-in localized name display, so you no longer need hand-written mapping tables.
- Stack traces are cleaner, which improves the debugging experience.
- It is worth upgrading to Node.js 14 LTS as soon as you can.
