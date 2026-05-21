---
title: "Node.js 在前端工程化中的應用"
date: 2018-10-13 15:20:33
tags:
  - JavaScript
readingTime: 1
description: "前端專案裡有很多可以用 Node.js 指令碼自動化的事情：程式碼生成、檔案處理、構建輔助等。"
wordCount: 167
---

前端專案裡有很多可以用 Node.js 指令碼自動化的事情：程式碼生成、檔案處理、構建輔助等。

## 檔案系統操作

```javascript
const fs = require("fs");
const path = require("path");

// 讀檔案
const content = fs.readFileSync("src/config.json", "utf-8");
const config = JSON.parse(content);

// 寫檔案
fs.writeFileSync("dist/config.json", JSON.stringify(config, null, 2));

// 遞迴建立目錄
fs.mkdirSync("dist/assets/images", { recursive: true });

// 非同步版本（推薦在腳本里用 fs/promises）
const { readFile, writeFile } = require("fs/promises");

async function processConfig() {
  const raw = await readFile("config.json", "utf-8");
  const config = JSON.parse(raw);
  config.buildTime = new Date().toISOString();
  await writeFile("dist/config.json", JSON.stringify(config, null, 2));
}
```

## 遍歷目錄

```javascript
const fs = require("fs");
const path = require("path");

// 遞迴獲取所有指定型別的檔案
function getAllFiles(dir, ext) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.name.endsWith(ext)) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

// 用法：找所有 Vue 檔案
const vueFiles = getAllFiles("src", ".vue");
console.log(`找到 ${vueFiles.length} 個 Vue 檔案`);
```

## 程式碼生成指令碼

根據配置自動生成路由和 API：

```javascript
// scripts/generate-routes.js
const fs = require("fs");
const pages = require("../src/pages.config.json");

const routeCode = `
// 自動生成，勿手動修改
export const routes = [
${pages
  .map(
    (page) => `  {
    path: '${page.path}',
    name: '${page.name}',
    component: () => import(/* webpackChunkName: "${page.name}" */ '${page.component}'),
    meta: ${JSON.stringify(page.meta)}
  }`,
  )
  .join(",\n")}
]
`;

fs.writeFileSync("src/router/routes.js", routeCode);
console.log("路由檔案生成完成");
```

## 批次重新命名

```javascript
// 把所有 .js 檔案重新命名為 .ts
const fs = require("fs");
const path = require("path");

function renameJsToTs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      renameJsToTs(fullPath);
    } else if (entry.name.endsWith(".js")) {
      const newPath = fullPath.replace(/\.js$/, ".ts");
      fs.renameSync(fullPath, newPath);
      console.log(
        `重新命名：${entry.name} → ${entry.name.replace(".js", ".ts")}`,
      );
    }
  }
}

renameJsToTs("src");
```

## 環境檢查指令碼

```javascript
// scripts/check-env.js
const required = ["VUE_APP_API_URL", "VUE_APP_OSS_BUCKET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("缺少必要的環境變數：");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1); // 非零退出碼，讓 CI 失敗
}

console.log("✓ 環境變數檢查通過");
```

```json
// package.json
{
  "scripts": {
    "build": "node scripts/check-env.js && vue-cli-service build"
  }
}
```

## 小結

- `fs` 模組：檔案讀寫、目錄操作
- `path` 模組：路徑處理（跨平臺）
- 程式碼生成：根據配置自動生成重複性程式碼
- 環境檢查：構建前驗證必要變數，CI 失敗比執行時錯誤容易發現
- Node.js 指令碼是前端工程化的重要組成部分
