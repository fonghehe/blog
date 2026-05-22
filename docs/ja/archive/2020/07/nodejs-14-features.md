---
title: "Node.js 14の新機能がフロントエンド開発に与える影響"
date: 2020-07-07 10:40:44
tags:
  - JavaScript
readingTime: 2
description: "Node.js 14 が LTS フェーズに入り、V8 エンジンが 8.1 にアップグレードされ、いくつかの便利な新機能がもたらされました。フロントエンドエンジニアとして、これらの変更はビルドツールやスクリプトに直接影響します。"
wordCount: 342
---

Node.js 14 が LTS フェーズに入り、V8 エンジンが 8.1 にアップグレードされ、いくつかの便利な新機能がもたらされました。フロントエンドエンジニアとして、これらの変更はビルドツールやスクリプトに直接影響します。

## Node.js でのオプショナルチェーンとNull合体のネイティブサポート

```javascript
// --harmony フラグは不要になりました！
// Node.js 14 でネイティブサポート

// オプショナルチェーン
const config = {
  database: {
    host: "localhost",
  },
};

const port = config?.database?.port ?? 3306;
console.log(port); // 3306

// 空値合体
const timeout = process.env.TIMEOUT ?? 5000;

// 実際のシナリオ：API レスポンスの処理
function processResponse(response) {
  const users = response?.data?.users ?? [];
  const total = response?.data?.total ?? 0;
  return { users, total };
}
```

## Top-level await

```javascript
// 以前：async 関数でラップする必要があった
async function main() {
  const config = await loadConfig();
  const db = await connectDB(config);
  // ...
}
main();

// Node.js 14：トップレベル await
// config.mjs
const config = await import("./config.json");
const response = await fetch("https://api.example.com/data");
const data = await response.json();

console.log("配置加载完成:", config);
console.log("数据获取完成:", data);

// 注意：.mjs または package.json で type: "module" が指定されたファイルでのみ使用可能
```

```json
// package.json 启用 ESM
{
  "type": "module"
}
```

## Intl.DisplayNames：国際化名称表示

```javascript
// 以前はマッピングテーブルが必要だった
const langMap = { zh: "中文", en: "English", ja: "日本語" };

// Node.js 14：ビルトイン API
const regionNames = new Intl.DisplayNames(["zh"], { type: "region" });
console.log(regionNames.of("CN")); // 中国
console.log(regionNames.of("US")); // アメリカ

const langNames = new Intl.DisplayNames(["zh"], { type: "language" });
console.log(langNames.of("zh")); // 中国語
console.log(langNames.of("en")); // 英語

// 実際のシナリオ：国際化フォームの国選択
function getCountryOptions(locale = "zh") {
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  return ["CN", "US", "JP", "KR", "GB"].map((code) => ({
    value: code,
    label: regionNames.of(code),
  }));
}
// [{ value: 'CN', label: '中国' }, { value: 'US', label: 'アメリカ' }, ...]
```

## 改善されたエラースタックトレース

```javascript
// Node.js 14 のエラースタックトレースはより明確に
// 以前は不要な internal/frames が表示されていた

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
// すっきりして、internal のノイズがない
```

## Stream パフォーマンスの向上

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
    // 大規模ファイルを行単位で処理し、OOM を防ぐ
    if (line.includes("ERROR")) {
      console.error(`第 ${lineCount} 行发现错误: ${line}`);
    }
  }

  return lineCount;
}
```

## フロントエンドツールチェーンへの影響

```javascript
// Webpack 5 は Node.js >= 10.13.0 が必要で、14 は完全互換
// Vite は Node.js >= 12.0.0 が必要で、14 は完全互換
// TypeScript 4.0 は Node.js 14 をサポート

// esbuild の最適パフォーマンスは Node.js 14 上
// Deno 互換性レイヤーには Node.js 14+ が必要

// バージョンチェックスクリプト
// scripts/check-node.js
const semver = require("semver");
const required = ">=14.0.0";

if (!semver.satisfies(process.version, required)) {
  console.error(`需要 Node.js ${required}，当前版本 ${process.version}`);
  process.exit(1);
}

console.log(`Node.js ${process.version} ✓`);
```

## アップグレード時の注意点

```bash
# nvm で Node.js のバージョンを管理することを推奨
nvm install 14
nvm use 14

# 破壊的変更の確認
# 1. 一部の非推奨 API が削除された
# 2. URL.parse() は非推奨で、new URL() を使用
# 3. 一部の Buffer メソッドが非推奨になった

# CI 設定の更新
# .github/workflows/ci.yml
- uses: actions/setup-node@v2
  with:
    node-version: '14'
```

## まとめ

- オプショナルチェーンとNull合体が Node.js でネイティブサポートされ、ビルドスクリプトでも使用可能に
- Top-level await によって ESM モジュールの非同期初期化コードが簡潔に
- Intl.DisplayNames で国際化名称表示がビルトインに、手動マッピングが不要に
- エラースタックトレースがよりクリーンになり、デバッグ体験が向上
- できるだけ早く Node.js 14 LTS へアップグレードすることを推奨
