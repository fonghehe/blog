---
title: "前端模塊化演進：從 CommonJS 到 ES Module"
date: 2018-01-23 15:20:10
tags:
  - 工程化
readingTime: 3
description: "前端模塊化呢條路走咗將近十年。從最初冇模塊系統，到各種規範百花齊放，再到 ES Module 標準化。理解呢段歷史能幫你睇清楚現在嘅工具鏈點解係咁設計。"
---

前端模塊化呢條路走咗將近十年。從最初冇模塊系統，到各種規範百花齊放，再到 ES Module 標準化。理解呢段歷史能幫你睇清楚現在嘅工具鏈點解係咁設計。

## 冇模塊系統嘅年代

早期 JavaScript 冇原生嘅模塊機制，所有代碼都係全局嘅：

```html
<script src="jquery.js"></script>
<script src="plugin-a.js"></script>
<script src="plugin-b.js"></script>
<script src="app.js"></script>
```

問題好明顯：

- 變量衝突（任何文件都能覆蓋全局變量）
- 依賴順序難以維護（必須按正確順序引入）
- 難以做按需加載

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

- **同步加載**：適合 Node.js 嘅磁盤 I/O，唔適合瀏覽器
- **動態**：`require` 可以寫喺條件語句或函數裡面
- **值拷貝**：`module.exports` 導出嘅係值嘅拷貝（原始值）或引用拷貝（對象）

## AMD（瀏覽器異步加載）

為咗解決瀏覽器裡面異步加載嘅問題，AMD 規範（RequireJS 實現）出現咗：

```javascript
// 定義模塊
define("math", [], function () {
  return {
    add: function (a, b) {
      return a + b;
    },
  };
});

// 使用模塊（異步加載）
require(["math", "utils"], function (math, utils) {
  console.log(math.add(1, 2));
});
```

AMD 喺 SPA 時代曾經好流行，但寫法冗長，隨住 Webpack 嘅出現基本上被取代咗。

## ES Module：語言層面嘅標準

ES2015（ES6）終於喺語言層面引入咗模塊系統：

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
export default { add, multiply }; // 默認導出

// main.js
import { add, multiply } from "./math";
import math from "./math"; // 導入默認導出
import * as mathUtils from "./math"; // 導入所有命名導出
```

**ES Module 同 CommonJS 嘅核心區別：**

```javascript
// CommonJS：值拷貝
// counter.js
let count = 0;
exports.count = count; // 導出嘅係當前值嘅拷貝
exports.increment = () => count++;

// main.js
const { count, increment } = require("./counter");
increment();
console.log(count); // 仍然係 0，拿到嘅係拷貝

// ES Module：實時綁定（live binding）
// counter.mjs
export let count = 0;
export function increment() {
  count++;
}

// main.mjs
import { count, increment } from "./counter.mjs";
increment();
console.log(count); // 1，實時反映變化
```

**靜態結構**：ES Module 嘅 `import/export` 必須喺頂層，唔可以放喺條件語句裡面。呢個令打包工具能夠喺編譯時靜態分析依賴關係，實現 Tree Shaking。

## Tree Shaking：ES Module 嘅工程價值

Tree Shaking（搖樹優化）依賴 ES Module 嘅靜態結構：

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
// formatCurrency 同 formatPhone 從未使用
```

Webpack 同 Rollup 分析依賴圖後，可以將未使用嘅 `formatCurrency` 同 `formatPhone` 從最終包裡面刪除。

```javascript
// CommonJS 格式無法做 Tree Shaking
const utils = require("./utils");
// 打包工具無法確定 utils 嘅邊啲屬性會被用到
```

呢個就係點解現代 npm 包要提供 ES Module 格式：`package.json` 裡面嘅 `module` 字段指向 ESM 版本：

```json
{
  "main": "dist/index.cjs.js", // CommonJS（Node.js 同舊版 Webpack）
  "module": "dist/index.esm.js", // ES Module（支援 Tree Shaking）
  "browser": "dist/index.umd.js" // UMD（直接喺瀏覽器裡面用）
}
```

## 2018 年嘅現狀

- **Node.js**：CommonJS 為主，ES Module 支援仲喺實驗階段（Node.js 9.6 開始，需要 `.mjs` 擴展名或 `--experimental-modules` flag）
- **瀏覽器**：Chrome 61、Safari 10.1、Firefox 54 已支援原生 `<script type="module">`，但生產環境仲係通過 Webpack/Rollup 打包
- **日常開發**：寫 ES Module 語法，Webpack + Babel 負責轉換

```html
<!-- 原生 ES Module（現代瀏覽器，開發/演示用） -->
<script type="module" src="app.js"></script>
<!-- 降級方案（唔支援 module 嘅瀏覽器） -->
<script nomodule src="app-legacy.js"></script>
```

呢種 `module/nomodule` 模式係目前差異化服務現代/舊版瀏覽器嘅標準方案，現代瀏覽器加載更細嘅模塊化包，舊瀏覽器加載帶有所有 polyfill 嘅大包。

---

_下一篇：React 16 Fiber 架構解析_
