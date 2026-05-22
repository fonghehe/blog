---
title: "Webpack Tree Shaking 原理和實踐：落地路徑與實戰建議"
date: 2018-10-06 10:55:15
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "`tree-shaking` 這個詞來自 Rollup，意思是把沒用到的代碼像樹葉一樣\"抖掉\"。Webpack 2 開始支援，但要正確設定才生效。"
wordCount: 225
---

`tree-shaking` 這個詞來自 Rollup，意思是把沒用到的代碼像樹葉一樣"抖掉"。Webpack 2 開始支持，但要正確配置才生效。

## 基本原理

Tree shaking 依賴 ES module 的**靜態結構**（import/export 在編譯時就確定，不能動態改變）：

```javascript
// ES module：靜態，可以分析
import { add } from "./math"; // 隻用了 add
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
} // 沒被導入，可以移除

// CommonJS：動態，無法分析
const math = require("./math"); // 整個對象都被引入，無法判斷用了哪些
const method = "add";
math[method](); // 動態訪問，tree shaking 不知道哪些方法會被用到
```

## 生效條件

```
1. 源代碼使用 ES module（import/export）
2. webpack mode 為 production
3. 不要用 babel 把 ES module 轉為 CommonJS
4. package.json 的 sideEffects 配置正確
```

## 設定 Babel 不轉 CommonJS

```javascript
// .babelrc 或 babel.config.js
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // 關鍵！不要轉 CommonJS
    }]
  ]
}
```

## sideEffects 設定

Webpack 需要知道哪些檔案有副作用（如 CSS、polyfill），不能被 tree-shaken：

```json
// package.json
{
  // 所有文件都沒有副作用，可以安全 tree-shake
  "sideEffects": false,

  // 或者列出有副作用的文件
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.js"]
}
```

## 驗證 Tree Shaking 是否生效

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
} // 我們不用這個

// main.js
import { add } from "./math";
console.log(add(1, 2));
```

生產構建後，`multiply` 應該不在 bundle 裏。用 `webpack-bundle-analyzer` 驗證。

## 常見問題

**問題一：第三方庫沒有 ES module 版本**

```javascript
// lodash 是 CommonJS，tree shaking 不生效
import { debounce } from "lodash"; // 會打包整個 lodash！

// 解決：用 lodash-es（ES module 版本）
import { debounce } from "lodash-es"; // ✅ 隻打包 debounce

// 或者按路徑引入
import debounce from "lodash/debounce"; // ✅ 也可以
```

**問題二：類的副作用**

```javascript
// 類方法通常不能被 tree-shaking（因為可能有副作用）
class Utils {
  static add(a, b) {
    return a + b;
  }
  static multiply(a, b) {
    return a * b;
  } // 即使沒用也可能被打進去
}

// 改成函數導出，tree-shaking 效果更好
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
```

## 效果

在我們項目裏，用了 lodash-es 並修復 sideEffects 配置之後：

```
lodash：從 70KB 降到 8KB（按實際使用）
整體 bundle：減少約 120KB（gzip 後約 40KB）
```

## 小結

- Tree shaking 依賴 ES module 靜態結構
- Babel 不要把 ES module 轉 CommonJS（`modules: false`）
- 配置 `sideEffects` 告知哪些文件不可 tree-shake
- 第三方庫優先選有 ES module 版本的（如 lodash-es）
