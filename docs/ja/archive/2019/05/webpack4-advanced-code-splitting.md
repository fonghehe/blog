---
title: "Webpack 4 Tree Shakingの仕組みを深く理解する"
date: 2019-05-22 10:35:50
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "Tree ShakingはWebpack 4の重要な最適化機能で、バンドル時に未使用のコードを自動的に除去します。しかし多くの人は`mode: 'production'`を設定すれば完了だと思っています——実際には理解する価値のある原理がたくさんあります。"
wordCount: 365
---

Tree ShakingはWebpack 4の重要な最適化機能で、バンドル時に未使用のコードを自動的に除去します。しかし多くの人は`mode: 'production'`を設定すれば完了だと思っています——実際には理解する価値のある原理がたくさんあります。

## Tree Shakingとは

「Tree Shaking（木を振る）」という名前は、木を振って枯れ葉を落とすことから来ています。Webpackの文脈では、「枯れ葉」とはどこからもインポートされていないモジュールのエクスポートのことです。

コアとなる前提：**ES Modulesの静的な構造**。

```javascript
// math.js - addとsubtractをエクスポート
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// app.js - addのみ使用
import { add } from "./math";

console.log(add(1, 2));
// subtractはどこからも参照されていない → 削除されるべき
```

バンドル後、`subtract`は最終出力に現れるべきではありません。

## なぜESMはできてCommonJSはできないのか

```javascript
// CommonJS - 動的ロード、コンパイル時にエクスポートを特定できない
const math = require("./math");
math.add(1, 2);
// 問題：mathオブジェクトにはどんなプロパティがあるか？
// 実行時にしか分からない → 静的解析不可能

// より極端な例
const modules = require("./modules");
const name = getModuleName();
modules[name](); // 完全に解析不可能
```

```javascript
// ESM - 静的インポート、コンパイル時に依存関係グラフが分かる
import { add } from "./math";
// 1. インポートされた識別子はコンパイル時に確定（if文の中に置けない）
// 2. モジュールのエクスポートも静的（動的に変更できない）
// 3. モジュールのトップレベル実行、条件分岐なし
```

## Webpack 4のTree Shakingワークフロー

Webpack 4のTree Shakingは2つのフェーズを持ちます：**マーキング**と**削除**。

```javascript
// utils.js
export function used() {
  // ← "used"としてマーク
  return "I am used";
}

export function unused() {
  // ← "unused"としてマーク
  return "I am unused";
}
```

```javascript
// webpack.config.js
module.exports = {
  mode: "production", // Tree ShakingとTerserを有効化
  optimization: {
    usedExports: true, // 未使用のエクスポートをマーク
    minimize: true, // Terserがデッドコードを削除
  },
};
```

## Tree Shakingが効かないよくある原因

1. **CommonJSを使用**：`require()`は静的解析を妨げる
2. **副作用がある**：`package.json`で純粋なモジュールをマーク：
   ```json
   { "sideEffects": false }
   // または副作用がある特定のファイルをリスト：
   { "sideEffects": ["./src/polyfills.js", "*.css"] }
   ```
3. **BabelがESMをCommonJSに変換**：BabelがimportとexportをなくさないようにNode：
   ```json
   { "presets": [["@babel/preset-env", { "modules": false }]] }
   ```

Tree Shakingは魔法ではありません——正しく機能するには、ES Modules、プロダクションモード、副作用のないコードが必要です。
