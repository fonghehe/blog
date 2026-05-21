---
title: "フロントエンドエンジニアリングにおける Node.js の活用"
date: 2018-10-13 15:20:33
tags:
  - JavaScript
readingTime: 2
description: "フロントエンドプロジェクトには Node.js スクリプトで自動化できることが多くあります：コード生成、ファイル処理、ビルド補助などです。"
wordCount: 274
---

フロントエンドプロジェクトには Node.js スクリプトで自動化できることが多くあります：コード生成、ファイル処理、ビルド補助などです。

## ファイルシステム操作

```javascript
const fs = require("fs");
const path = require("path");

// ファイルを読み込む
const content = fs.readFileSync("src/config.json", "utf-8");
const config = JSON.parse(content);

// ファイルを書き込む
fs.writeFileSync("dist/config.json", JSON.stringify(config, null, 2));

// ディレクトリを再帰的に作成
fs.mkdirSync("dist/assets/images", { recursive: true });

// 非同期バージョン（スクリプトでは fs/promises の使用を推奨）
const { readFile, writeFile } = require("fs/promises");

async function processConfig() {
  const raw = await readFile("config.json", "utf-8");
  const config = JSON.parse(raw);
  config.buildTime = new Date().toISOString();
  await writeFile("dist/config.json", JSON.stringify(config, null, 2));
}
```

## ディレクトリのトラバース

```javascript
const fs = require("fs");
const path = require("path");

// 指定した拡張子のファイルをすべて再帰的に収集
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

// 使用例：すべての Vue ファイルを検索
const vueFiles = getAllFiles("src", ".vue");
console.log(`${vueFiles.length} 個の Vue ファイルが見つかりました`);
```

## コード生成スクリプト

設定からルートと API を自動生成：

```javascript
// scripts/generate-routes.js
const fs = require("fs");
const pages = require("../src/pages.config.json");

const routeCode = `
// 自動生成 — 手動で編集しないでください
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
console.log("ルートファイルの生成が完了しました");
```

## バッチリネーム

```javascript
// すべての .js ファイルを .ts にリネーム
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
        `リネーム：${entry.name} → ${entry.name.replace(".js", ".ts")}`,
      );
    }
  }
}

renameJsToTs("src");
```

## 環境チェックスクリプト

```javascript
// scripts/check-env.js
const required = ["VUE_APP_API_URL", "VUE_APP_OSS_BUCKET"];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("必要な環境変数が不足しています：");
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1); // 非ゼロの終了コードで CI を失敗させる
}

console.log("✓ 環境変数のチェックが完了しました");
```

```json
// package.json
{
  "scripts": {
    "build": "node scripts/check-env.js && vue-cli-service build"
  }
}
```

## まとめ

- `fs` モジュール：ファイルの読み書き、ディレクトリ操作
- `path` モジュール：パス処理（クロスプラットフォーム）
- コード生成：設定から繰り返しのボイラープレートを自動生成
- 環境チェック：ビルド前に必要な変数を検証 — ランタイムエラーよりCI の失敗の方が発見しやすい
- Node.js スクリプトはフロントエンドエンジニアリングの重要な構成要素
