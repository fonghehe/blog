---
title: "フロントエンドパフォーマンス最適化：Tree Shakingの深掘り実践"
date: 2018-05-29 15:51:05
tags:
  - フロントエンド
readingTime: 2
description: "Tree Shakingはモダンなフロントエンドエンジニアリングの重要な最適化手段ですが、実際の効果が期待通りにならないことがよくあります。背後にある理由を深く理解する価値があります。"
---

Tree Shakingはモダンなフロントエンドエンジニアリングの重要な最適化手段ですが、実際の効果が期待通りにならないことがよくあります。背後にある理由を深く理解する価値があります。

## Tree Shakingとは

Tree ShakingはES Moduleの静的な特性を活用し、バンドル時に使用されていないコード（デッドコードの削除）を取り除きます：

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // 使用されていない

// main.js
import { add } from "./utils";
console.log(add(1, 2));
// subtractはインポートされていない — Tree Shakingでバンドルから除外される
```

**前提条件**：ES Module（`import/export`）を使用する必要があります。CommonJS（`require`）はTree Shakingできません。

## Tree Shakingが効かない場合の理由

### 理由1：CommonJSモジュールを使用している

```javascript
// ❌ CommonJS — Tree Shaking不可
const { add } = require("./utils");

// ✅ ES Module
import { add } from "./utils";
```

Babel 7以前は`@babel/preset-env`がデフォルトでES ModuleをCommonJSに変換していたため、Tree Shakingが無効化されていました。

**修正：**

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false, // ES Moduleを変換しない — webpackに任せる
      },
    ],
  ],
};
```

### 理由2：副作用（Side Effects）

モジュールに副作用がある場合（実行時にグローバル状態を変更する）、Tree Shakingは保守的にそれを保持します：

```javascript
// 副作用のあるモジュール：実行時にグローバルを変更
window.myLib = { version: '1.0' }
export function doSomething() { ... }
```

`package.json`でどのファイルに副作用があるかを宣言：

```json
{
  "sideEffects": [
    "*.css", // CSSファイルは副作用あり（グローバルスタイル）
    "src/polyfills.js"
  ]
}
```

または、完全に副作用がないことを宣言：

```json
{
  "sideEffects": false
}
```

### 理由3：インポート方法が間違っている

```javascript
// ❌ パッケージ全体をインポート
import _ from "lodash";
_.chunk([1, 2, 3, 4], 2); // lodash全体がバンドルされる

// ✅ 特定の関数をインポート
import chunk from "lodash/chunk";

// ✅ lodash-es（ES Module版）を使用
import { chunk } from "lodash-es";
```

### 理由4：名前空間インポート + 分割代入

```javascript
// ❌ オンデマンドインポートに見えるが、実際はモジュール全体をインポート
import * as utils from "./utils";
const { add } = utils;

// ✅ 直接の名前付きインポート
import { add } from "./utils";
```

## Tree Shakingの効果を検証する

```javascript
// ビルド後にバンドル内に削除した関数名が含まれているか確認
// Tree Shakingが機能していれば、削除した関数名は現れないはず
grep -r "subtract" dist/
```

または`webpack-bundle-analyzer`を使って視覚的に確認できます。

## サードパーティライブラリのTree Shaking

ES Moduleを提供しているライブラリのみTree Shakingをサポートします：

| ライブラリ   | Tree Shakingサポート         |
| ------------ | ---------------------------- |
| `lodash`     | ❌ CommonJS                  |
| `lodash-es`  | ✅ ES Module                 |
| `vue`        | ✅（2.6+）                   |
| `element-ui` | babel-plugin-componentが必要 |
| `date-fns`   | ✅ ES Module                 |
| `moment`     | ❌ day.jsへの移行を推奨      |

## Element UIのTree Shaking

```javascript
// 方法1：babel-plugin-component（自動オンデマンドインポート）
// babel.config.js
{
  plugins: [
    [
      "component",
      { libraryName: "element-ui", styleLibraryName: "theme-chalk" },
    ],
  ];
}

// 方法2：手動オンデマンドインポート
import { Button, Input } from "element-ui";
```

## まとめ

- Tree ShakingにはES Moduleが必要 — CommonJSは使わない
- BabelでES Moduleの変換を防ぐために`modules: false`を設定
- `package.json`で`sideEffects`を宣言してバンドラーのより賢い判断を助ける
- lodashなどの大きなライブラリはES Module版（`lodash-es`）を使うか個別関数をインポート
