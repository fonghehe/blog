---
title: "前端模組化演進：從 CommonJS 到 ES Module"
date: 2018-01-23 15:20:10
tags:
  - 工程化
readingTime: 3
description: "前端模組化這條路走了將近十年。從最初沒有模組系統，到各種規範百花齊放，再到 ES Module 標準化。理解這段歷史能幫你看清楚現在的工具鏈為什麼這樣設計。"
wordCount: 593
---

前端模組化這條路走了將近十年。從最初沒有模組系統，到各種規範百花齊放，再到 ES Module 標準化。理解這段歷史能幫你看清楚現在的工具鏈為什麼這樣設計。

## 沒有模組系統的年代

早期 JavaScript 沒有原生的模組機製，所有程式碼都是全域的：

```html
<script src="jquery.js"></script>
<script src="plugin-a.js"></script>
<script src="plugin-b.js"></script>
<script src="app.js"></script>
```

問題很明顯：

- 變數衝突（任何檔案都能覆蓋全域變數）
- 依賴順序難以維護（必須按正確順序引入）
- 難以做按需載入

## CommonJS（Node.js 生態）

2009 年，CommonJS 規範隨 Node.js 出現：

```javascript
// math.js
function add(a, b) {
  return a + b;
}
function multiply(a, b) {
  return a * b;
}

module.exports = { add, multiply };

// main.js
const math = require("./math");
console.log(math.add(1, 2));

// 解構
const { add } = require("./math");
```

特點：

- **同步載入**：適合 Node.js 的磁碟 I/O，不適合瀏覽器
- **動態**：`require` 可以寫在條件陳述式或函式裡
- **值拷貝**：`module.exports` 匯出的是值的拷貝（原始值）或參考拷貝（物件）

## AMD（瀏覽器非同步載入）

為了解決瀏覽器裡非同步載入的問題，AMD 規範（RequireJS 實作）出現了：

```javascript
// 定義模組
define("math", [], function () {
  return {
    add: function (a, b) {
      return a + b;
    },
  };
});

// 使用模組（非同步載入）
require(["math", "utils"], function (math, utils) {
  console.log(math.add(1, 2));
});
```

AMD 在 SPA 時代曾經很流行，但寫法冗長，隨著 Webpack 的出現基本被取代了。

## ES Module：語言層面的標準

ES2015（ES6）終於在語言層面引入了模組系統：

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
export default { add, multiply }; // 預設匯出

// main.js
import { add, multiply } from "./math";
import math from "./math"; // 匯入預設匯出
import * as mathUtils from "./math"; // 匯入所有具名匯出
```

**ES Module 和 CommonJS 的核心區別：**

```javascript
// CommonJS：值拷貝
// counter.js
let count = 0;
exports.count = count; // 匯出的是當前值的拷貝
exports.increment = () => count++;

// main.js
const { count, increment } = require("./counter");
increment();
console.log(count); // 仍然是 0，拿到的是拷貝

// ES Module：即時繫結（live binding）
// counter.mjs
export let count = 0;
export function increment() {
  count++;
}

// main.mjs
import { count, increment } from "./counter.mjs";
increment();
console.log(count); // 1，即時反映變化
```

**靜態結構**：ES Module 的 `import/export` 必須在頂層，不能放在條件陳述式裡。這使得打包工具能在編譯時靜態分析依賴關係，實作 Tree Shaking。

## Tree Shaking：ES Module 的工程價值

Tree Shaking（搖樹最佳化）依賴 ES Module 的靜態結構：

```javascript
// utils.js（ES Module 格式）
export function formatDate(date) {
  /* ... */
}
export function formatCurrency(amount) {
  /* ... */
}
export function formatPhone(phone) {
  /* ... */
}

// app.js
import { formatDate } from "./utils";
// formatCurrency 和 formatPhone 從未使用
```

Webpack 和 Rollup 分析依賴圖後，可以把未使用的 `formatCurrency` 和 `formatPhone` 從最終套件裡刪除。

```javascript
// CommonJS 格式無法做 Tree Shaking
const utils = require("./utils");
// 打包工具無法確定 utils 的哪些屬性會被用到
```

這就是為什麼現代 npm 套件要提供 ES Module 格式：`package.json` 裡的 `module` 欄位指向 ESM 版本：

```json
{
  "main": "dist/index.cjs.js", // CommonJS（Node.js 和舊版 Webpack）
  "module": "dist/index.esm.js", // ES Module（支援 Tree Shaking）
  "browser": "dist/index.umd.js" // UMD（直接在瀏覽器裡用）
}
```

## 2018 年的現狀

- **Node.js**：CommonJS 為主，ES Module 支援還在實驗階段（Node.js 9.6 開始，需要 `.mjs` 副檔名或 `--experimental-modules` flag）
- **瀏覽器**：Chrome 61、Safari 10.1、Firefox 54 已支援原生 `<script type="module">`，但正式環境還是透過 Webpack/Rollup 打包
- **日常開發**：寫 ES Module 語法，Webpack + Babel 負責轉換

```html
<!-- 原生 ES Module（現代瀏覽器，開發/展示用） -->
<script type="module" src="app.js"></script>
<!-- 降級方案（不支援 module 的瀏覽器） -->
<script nomodule src="app-legacy.js"></script>
```

這種 `module/nomodule` 模式是目前差異化服務現代/舊版瀏覽器的標準方案，現代瀏覽器載入更小的模組化套件，舊瀏覽器載入帶有所有 polyfill 的大套件。

---

_下一篇：React 16 Fiber 架構解析_
