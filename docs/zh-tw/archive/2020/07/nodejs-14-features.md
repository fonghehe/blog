---
title: "Node.js 14 新特性對前端的影響"
date: 2020-07-07 10:40:44
tags:
  - JavaScript
readingTime: 2
description: "Node.js 14 進入 LTS 階段，升級了 V8 引擎到 8.1，帶來了一些實用的新特性。作為前端工程師，這些變化直接影響我們的構建工具和指令碼。"
wordCount: 195
---

Node.js 14 進入 LTS 階段，升級了 V8 引擎到 8.1，帶來了一些實用的新特性。作為前端工程師，這些變化直接影響我們的構建工具和指令碼。

## 可選鏈和空值合併在 Node.js 中原生支援

```javascript
// 不需要 --harmony 標誌了！
// Node.js 14 直接支援

// 可選鏈
const config = {
  database: {
    host: "localhost",
  },
};

const port = config?.database?.port ?? 3306;
console.log(port); // 3306

// 空值合併
const timeout = process.env.TIMEOUT ?? 5000;

// 實際場景：處理 API 響應
function processResponse(response) {
  const users = response?.data?.users ?? [];
  const total = response?.data?.total ?? 0;
  return { users, total };
}
```

## Top-level await

```javascript
// 以前：必須包在 async 函數里
async function main() {
  const config = await loadConfig();
  const db = await connectDB(config);
  // ...
}
main();

// Node.js 14：頂層 await
// config.mjs
const config = await import("./config.json");
const response = await fetch("https://api.example.com/data");
const data = await response.json();

console.log("配置載入完成:", config);
console.log("資料獲取完成:", data);

// 注意：隻能在 .mjs 或 package.json 中 type: "module" 的檔案中使用
```

```json
// package.json 啟用 ESM
{
  "type": "module"
}
```

## Intl.DisplayNames：國際化名稱顯示

```javascript
// 以前需要一個對映表
const langMap = { zh: "中文", en: "English", ja: "日本語" };

// Node.js 14：內建 API
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("CN")); // 中國
console.log(regionNames.of("US")); // 美國

const langNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(langNames.of("zh")); // 中文
console.log(langNames.of("en")); // 英語

// 實際場景：國際化表單中的國家選擇
function getCountryOptions(locale = "zh") {
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  return ["CN", "US", "JP", "KR", "GB"].map((code) => ({
    value: code,
    label: regionNames.of(code),
  }));
}
// [{ value: 'CN', label: '中國' }, { value: 'US', label: '美國' }, ...]
```

## 更好的錯誤堆積疊

```javascript
// Node.js 14 的錯誤堆疊更清晰
// 以前會顯示一些無用的 internal/frames

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
// 乾淨多了，沒有 internal 的噪音
```

## Stream 效能提升

```javascript
// readable.iterator() 支援 for-await-of
import { createReadStream } from "fs";
import { createInterface } from "readline";

async function processLargeFile(filePath) {
  const stream = createReadStream(filePath);
  const rl = createInterface({ input: stream });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    // 逐行處理大檔案，不會 OOM
    if (line.includes("ERROR")) {
      console.error(`第 ${lineCount} 行發現錯誤: ${line}`);
    }
  }

  return lineCount;
}
```

## 對前端工具鏈的影響

```javascript
// Webpack 5 要求 Node.js >= 10.13.0，14 完全相容
// Vite 要求 Node.js >= 12.0.0，14 完全相容
// TypeScript 4.0 支援 Node.js 14

// esbuild 最佳效能在 Node.js 14 上
// Deno 相容性層需要 Node.js 14+

// 檢查版本的指令碼
// scripts/check-node.js
const semver = require("semver");
const required = ">=14.0.0";

if (!semver.satisfies(process.version, required)) {
  console.error(`需要 Node.js ${required}，當前版本 ${process.version}`);
  process.exit(1);
}

console.log(`Node.js ${process.version} ✓`);
```

## 升級注意事項

```bash
# 推薦用 nvm 管理 Node.js 版本
nvm install 14
nvm use 14

# 檢查破壞性變更
# 1. 一些廢棄的 API 被移除了
# 2. URL.parse() 被廢棄，用 new URL() 替代
# 3. 一些 Buffer 方法被廢棄

# CI 設定更新
# .github/workflows/ci.yml
- uses: actions/setup-node@v2
  with:
    node-version: '14'
```

## 小結

- 可選鏈和空值合併在 Node.js 中原生支援，構建指令碼也可以用了
- Top-level await 簡化了 ESM 模組的非同步初始化程式碼
- Intl.DisplayNames 內建國際化名稱顯示，不再需要手動對映
- 錯誤堆疊更乾淨，除錯體驗更好
- 建議儘快升級到 Node.js 14 LTS
