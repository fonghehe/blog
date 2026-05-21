---
title: "Node.js 在前端工程化中的应用"
date: 2018-10-13 15:20:33
tags:
  - JavaScript
readingTime: 1
description: "前端项目里有很多可以用 Node.js 脚本自动化的事情：代码生成、文件处理、构建辅助等。"
wordCount: 158
---

前端项目里有很多可以用 Node.js 脚本自动化的事情：代码生成、文件处理、构建辅助等。

## 文件系统操作

```javascript
const fs = require("fs");
const path = require("path");

// 读文件
const content = fs.readFileSync("src/config.json", "utf-8");
const config = JSON.parse(content);

// 写文件
fs.writeFileSync("dist/config.json", JSON.stringify(config, null, 2));

// 递归创建目录
fs.mkdirSync("dist/assets/images", { recursive: true });

// 异步版本（推荐在脚本里用 fs/promises）
const { readFile, writeFile } = require("fs/promises");

async function processConfig() {
  const raw = await readFile("config.json", "utf-8");
  const config = JSON.parse(raw);
  config.buildTime = new Date().toISOString();
  await writeFile("dist/config.json", JSON.stringify(config, null, 2));
}
```

## 遍历目录

```javascript
const fs = require("fs");
const path = require("path");

// 递归获取所有指定类型的文件
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
console.log(`找到 ${vueFiles.length} 个 Vue 文件`);
```

## 代码生成脚本

根据配置自动生成路由和 API：

```javascript
// scripts/generate-routes.js
const fs = require("fs");
const pages = require("../src/pages.config.json");

const routeCode = `
// 自动生成，勿手动修改
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
// 把所有 .js 文件重命名为 .ts
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

## 环境检查脚本

```javascript
// scripts/check-env.js
const required = ["VUE_APP_API_URL", "VUE_APP_OSS_BUCKET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("缺少必要的环境变量：");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1); // 非零退出码，让 CI 失败
}

console.log("✓ 环境变量检查通过");
```

```json
// package.json
{
  "scripts": {
    "build": "node scripts/check-env.js && vue-cli-service build"
  }
}
```

## 小结

- `fs` 模块：文件读写、目录操作
- `path` 模块：路径处理（跨平台）
- 代码生成：根据配置自动生成重复性代码
- 环境检查：构建前验证必要变量，CI 失败比运行时错误容易发现
- Node.js 脚本是前端工程化的重要组成部分
