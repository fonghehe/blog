---
title: "フロントエンドモジュール化の進化：CommonJS から ES Module へ"
date: 2018-01-23 15:20:10
tags:
  - エンジニアリング
readingTime: 2
description: "2018年現在、CommonJS、AMD、ES Module という複数のモジュールシステムが共存しています。それぞれの違いを理解することで、webpack や Babel といったツールが存在する理由が分かります。"
---

2018年現在、CommonJS、AMD、ES Module という複数のモジュールシステムが共存しています。それぞれの違いを理解することで、webpack や Babel といったツールが存在する理由が分かります。

## モジュール以前の時代

初期の JavaScript にはモジュールシステムがありませんでした。すべてのスクリプトがグローバルスコープを共有：

```html
<script src="jquery.js"></script>
<script src="plugin.js"></script>
<!-- グローバルスコープの jQuery に依存 -->
<script src="app.js"></script>
```

問題点：命名の衝突、依存関係の順序を手動管理、ファイルの依存関係を把握できない。

## CommonJS（Node.js）

```javascript
// math.js — エクスポート
exports.add = function (a, b) {
  return a + b;
};

// app.js — インポート
const { add } = require("./math");
```

CommonJS は**同期的**ローディングを使用します。Node.js（ディスクから読み取る）では問題ありませんが、ブラウザでは同期ネットワークリクエストはページをブロックします。

## AMD（ブラウザ向け）

```javascript
define(["jquery", "lodash"], function ($, _) {
  return {
    render: function (data) {
      return _.template("<div>...</div>")(data);
    },
  };
});
```

AMD はブラウザの非同期ローディング問題を解決しましたが、`define` 構文が冗長でした。

## ES Module（ES6 標準）

```javascript
// 名前付きエクスポート
export function add(a, b) { return a + b; }
export const PI = 3.14159;

// デフォルトエクスポート
export default class Calculator { ... }

// インポート
import { add, PI } from './math.js';
import Calculator from './calculator.js';
import * as math from './math.js';
```

ES Module は現代の標準です。主なメリット：

1. **静的解析** — インポートは解析時に解決され、Tree Shaking を可能にする
2. **ライブバインディング** — インポートされた値はオリジナルの更新を反映する
3. デフォルトで**厳格モード**
4. ネイティブブラウザサポート（`<script type="module">`）

## ライブバインディング vs 値コピー

```javascript
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// main.js（ES Module）
import { count, increment } from "./counter.js";
increment();
console.log(count); // 1 — ライブバインディング、更新された値を参照

// main.js（CommonJS）
const { count, increment } = require("./counter.js");
increment();
console.log(count); // 0 — 値コピー、更新を参照できない
```

## Tree Shaking

Tree Shaking が可能なのは、まさに ES Module の静的解析のおかげです：

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // インポートされない

// main.js
import { add } from "./utils.js";

// バンドル後：subtract はバンドルから除去される
```

## module/nomodule パターン

```html
<!-- モダンブラウザ：ネイティブ ES Module サポート -->
<script type="module" src="app.modern.js"></script>

<!-- レガシーブラウザ：バンドル版 -->
<script nomodule src="app.legacy.js"></script>
```

モダンブラウザは `app.modern.js` をダウンロードし `nomodule` を無視します。古いブラウザは `type="module"` を無視し `app.legacy.js` をダウンロードします。
