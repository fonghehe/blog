---
title: "Node.js 在前端工程化中的應用：實踐方法與治理思路"
date: 2018-10-13 15:20:33
tags:
  - JavaScript
readingTime: 1
description: "前端項目裏有很多可以用 Node.js 腳本自動化的事情：代碼生成、檔案處理、構建輔助等。"
wordCount: 158
---

前端項目裏有很多可以用 Node.js 腳本自動化的事情：代碼生成、文件處理、構建輔助等。

## 檔案系統操作

```javascript
const fs = require("fs");
const path = require("path");

// 讀文件
const content = fs.readFileSync("src/config.json", "utf-8");
const config = JSON.parse(content);

// 寫文件
fs.writeFileSync("dist/config.json", JSON.stringify(config, null, 2));

// 遞歸創建目錄
fs.mkdirSync("dist/assets/images", { recursive: true });

// 異步版本（推薦在腳本里用 fs/promises）
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

// 遞歸獲取所有指定類型的文件
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

// 用法：找所有 Vue 文件
const vueFiles = getAllFiles("src", ".vue");
console.log(`找到 ${vueFiles.length} 個 Vue 文件`);
```

## 代碼生成腳本

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
console.log("路由文件生成完成");
```

## 批量重命名

```javascript
// 把所有 .js 文件重命名為 .ts
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
        `重命名：${entry.name} → ${entry.name.replace(".js", ".ts")}`,
      );
    }
  }
}

renameJsToTs("src");
```

## 環境檢查腳本

```javascript
// scripts/check-env.js
const required = ["VUE_APP_API_URL", "VUE_APP_OSS_BUCKET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("缺少必要的環境變量：");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1); // 非零退出碼，讓 CI 失敗
}

console.log("✓ 環境變量檢查通過");
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

- `fs` 模塊：文件讀寫、目錄操作
- `path` 模塊：路徑處理（跨平臺）
- 代碼生成：根據配置自動生成重複性代碼
- 環境檢查：構建前驗證必要變量，CI 失敗比運行時錯誤容易發現
- Node.js 腳本是前端工程化的重要組成部分
