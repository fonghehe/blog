---
title: "JavaScriptモジュール化の進化史：IIFEからES Modulesまで"
date: 2019-06-10 10:39:59
tags:
  - JavaScript
readingTime: 2
description: "JavaScriptはかなり長い期間、ネイティブのモジュールシステムを持っていませんでした。コミュニティはその歴史の中で多くの解決策を探求しました。この進化を理解することで、現代のツールチェーンがなぜそのように構築されているかが分かります。"
wordCount: 338
---

JavaScriptはかなり長い期間、ネイティブのモジュールシステムを持っていませんでした。コミュニティはその歴史の中で多くの解決策を探求しました。この進化を理解することで、現代のツールチェーンがなぜそのように構築されているかが分かります。

## 第1段階：グローバル変数（混沌とした時代）

```javascript
// utils.js — グローバルスコープを汚染
var utils = {
  formatDate: function (date) {
    /* ... */
  },
};

// app.js — グローバル変数に依存
utils.formatDate(new Date());

// 問題：命名の衝突、不明確な依存順序、
// どのスクリプトを先に読み込むか判断困難
```

## 第2段階：IIFE（即時実行関数式）

```javascript
// クロージャでプライベート変数をカプセル化
var MyModule = (function () {
  // プライベート変数
  var privateData = "内部データ";

  // プライベート関数
  function privateMethod() {
    return privateData;
  }

  // パブリックAPI
  return {
    getData: function () {
      return privateMethod();
    },
    setData: function (value) {
      privateData = value;
    },
  };
})();

MyModule.getData(); // 動作する
MyModule.privateData; // undefined — カプセル化されている
```

## 第3段階：CommonJS（Node.js）

```javascript
// math.js
function add(a, b) {
  return a + b;
}
module.exports = { add };

// app.js
const { add } = require("./math");
console.log(add(1, 2)); // 3

// 問題：同期読み込み——ブラウザには不適切
//（ネットワークリクエストは本質的に非同期）
```

## 第4段階：AMD（ブラウザ非同期）

```javascript
// RequireJS: define/requireによる非同期読み込み
define(["jquery", "underscore"], function ($, _) {
  function MyView() {
    this.$el = $("<div>");
  }
  return MyView;
});

// 問題：冗長な構文；最終的な答えではなかった
```

## 第5段階：UMD（ユニバーサル）

```javascript
// CommonJS + AMD + グローバル変数と互換
(function (global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(); // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(factory); // AMD
  } else {
    global.MyLib = factory(); // グローバル
  }
})(this, function () {
  return { version: "1.0.0" };
});
```

## 第6段階：ES Modules（ネイティブ標準）

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export const PI = 3.14159;
export default class Calculator {
  /* ... */
}

// app.js
import Calculator, { add, PI } from "./math.js";
import * as MathUtils from "./math.js";

// ネイティブブラウザサポート
// <script type="module" src="app.js"></script>
```

ES Modulesの主要な利点：

- **静的解析**：インポート/エクスポートはパース時に確定するため、ツリーシェイキングが可能
- **ライブバインディング**：インポートされた値はコピーではなくライブバインディングを反映
- **ネイティブサポート**：モダンブラウザとNode.js 12+がネイティブでサポート

2019年の実践的な設定は：ESMソースコードを書き、Webpack/Rollup/Babelを使って古い環境向けの互換フォーマットにコンパイルします。
