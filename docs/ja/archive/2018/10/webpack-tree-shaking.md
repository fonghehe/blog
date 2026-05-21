---
title: "Webpack Tree Shaking の原理と実践"
date: 2018-10-06 10:55:15
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "「tree shaking」という言葉は Rollup から来ており、使われていないコードを木の葉のように「振り落とす」という意味です。Webpack 2 からサポートされていますが、正しく設定しないと機能しません。"
wordCount: 378
---

「tree shaking」という言葉は Rollup から来ており、使われていないコードを木の葉のように「振り落とす」という意味です。Webpack 2 からサポートされていますが、正しく設定しないと機能しません。

## 基本原理

Tree shaking は ES モジュールの**静的な構造**（import/export はコンパイル時に決定され、動的に変更できない）に依存します：

```javascript
// ES モジュール：静的 — コンパイル時に解析可能
import { add } from "./math"; // add のみを使用
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
} // インポートされていない — 削除可能

// CommonJS：動的 — 解析不可
const math = require("./math"); // オブジェクト全体がインポートされる。どの部分が使われるか不明
const method = "add";
math[method](); // 動的アクセス — tree shaking はどのメソッドが使われるか分からない
```

## 機能させる条件

```
1. ソースコードが ES モジュール（import/export）を使用している
2. webpack の mode が production
3. Babel が ES モジュールを CommonJS に変換していない
4. package.json の sideEffects が正しく設定されている
```

## Babel が CommonJS に変換しないよう設定

```javascript
// .babelrc または babel.config.js
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // 重要！CommonJS に変換しない
    }]
  ]
}
```

## sideEffects の設定

Webpack はどのファイルに副作用（CSS、polyfill など）があり、tree shake してはいけないかを知る必要があります：

```json
// package.json
{
  // すべてのファイルに副作用がない — 安全に tree shake できる
  "sideEffects": false,

  // または副作用のあるファイルをリストアップ
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.js"]
}
```

## Tree Shaking が機能しているか検証

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
}
export function multiply(a, b) {
  return a * b;
} // 使用しない

// main.js
import { add } from "./math";
console.log(add(1, 2));
```

本番ビルド後、`multiply` がバンドルに含まれていないことを確認します。`webpack-bundle-analyzer` で検証してください。

## よくある問題

**問題1：サードパーティライブラリに ES モジュール版がない**

```javascript
// lodash は CommonJS — tree shaking が機能しない
import { debounce } from "lodash"; // lodash 全体がバンドルされる！

// 解決策：lodash-es（ES モジュール版）を使用
import { debounce } from "lodash-es"; // ✅ debounce のみがバンドルされる

// またはパスで直接インポート
import debounce from "lodash/debounce"; // ✅ これも可
```

**問題2：クラスの副作用**

```javascript
// クラスメソッドは通常 tree shake できない（副作用がある可能性があるため）
class Utils {
  static add(a, b) {
    return a + b;
  }
  static multiply(a, b) {
    return a * b;
  } // 使用していなくても含まれる可能性がある
}

// 関数としてエクスポートする形式に変更すると tree shaking の効果が高い
export function add(a, b) {
  return a + b;
}
```

## まとめ

- Tree shaking には ES モジュールが必要 — Babel は CommonJS に変換してはいけない
- package.json に `sideEffects: false` を設定する（副作用のあるファイルはリストアップする）
- `webpack-bundle-analyzer` で結果を検証する
- `lodash` を `lodash-es` に切り替えるとユーティリティライブラリの tree shaking が向上する
