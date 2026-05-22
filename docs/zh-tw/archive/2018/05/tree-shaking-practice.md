---
title: "前端效能最佳化：Tree Shaking 深度實踐"
date: 2018-05-29 15:51:05
tags:
  - 前端
readingTime: 2
description: "Tree Shaking 是現代前端工程的重要最佳化手段，但實際效果經常不如預期，背後原因值得深究。"
wordCount: 353
---

Tree Shaking 是現代前端工程的重要最佳化手段，但實際效果經常不如預期，背後原因值得深究。

## Tree Shaking 是什麼

Tree Shaking 利用 ES Module 的靜態特性，在打包時刪除沒有被使用的程式碼（dead code elimination）：

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // 沒被使用

// main.js
import { add } from "./utils";
console.log(add(1, 2));
// subtract 從未被 import，Tree Shaking 後不會出現在 bundle 裡
```

**前提條件**：必須使用 ES Module（`import/export`），CommonJS（`require`）無法 Tree Shaking。

## 為什麼有時 Tree Shaking 不生效

### 原因 1：使用了 CommonJS 模組

```javascript
// ❌ CommonJS，無法 Tree Shaking
const { add } = require("./utils");

// ✅ ES Module
import { add } from "./utils";
```

Babel 7 之前會把 ES Module 轉成 CommonJS（`@babel/preset-env` 的預設行為），導致 Tree Shaking 失效。

**修復：**

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false, // 不轉換 ES Module，讓 webpack 處理
      },
    ],
  ],
};
```

### 原因 2：副作用（Side Effects）

如果模組有副作用（執行時修改了全域性狀態），Tree Shaking 會保守地保留它：

```javascript
// 有副作用的模組：執行時修改了全域性
window.myLib = { version: '1.0' }
export function doSomething() { ... }
```

在 `package.json` 宣告哪些檔案有副作用：

```json
{
  "sideEffects": [
    "*.css", // CSS 檔案有副作用（全域性樣式）
    "src/polyfills.js"
  ]
}
```

或者宣告完全沒有副作用：

```json
{
  "sideEffects": false
}
```

### 原因 3：引入方式錯誤

```javascript
// ❌ 匯入整個包
import _ from "lodash";
_.chunk([1, 2, 3, 4], 2); // 整個 lodash 都被打包

// ✅ 匯入具體函式
import chunk from "lodash/chunk";

// ✅ 使用 lodash-es（ES Module 版本）
import { chunk } from "lodash-es";
```

### 原因 4：物件解構匯入

```javascript
// ❌ 看起來像按需匯入，但實際上匯入了整個 module
import * as utils from "./utils";
const { add } = utils;

// ✅ 直接命名匯入
import { add } from "./utils";
```

## 驗證 Tree Shaking 效果

```javascript
// 構建後檢查 bundle 裡是否還有 "subtract" 字串
// 如果 Tree Shaking 生效，已刪除的函式名不應該出現
grep -r "subtract" dist/
```

或者用 `webpack-bundle-analyzer` 視覺化檢視。

## 第三方庫的 Tree Shaking

隻有提供 ES Module 的庫才支援 Tree Shaking：

| 庫           | Tree Shaking 支援           |
| 
------------ | --------------------------- |
| `lodash`     | ❌ CommonJS                 |
| `lodash-es`  | ✅ ES Module                |
| `vue`        | ✅（2.6+）                  |
| `element-ui` | 需要 babel-plugin-component |
| `date-fns`   | ✅ ES Module                |
| `moment`     | ❌ 建議換 day.js            |

## Element UI 的 Tree Shaking

```javascript
// 方法一：babel-plugin-component（自動按需引入）
// babel.config.js
{
  plugins: [
    [
      "component",
      { libraryName: "element-ui", styleLibraryName: "theme-chalk" },
    ],
  ];
}

// 方法二：手動按需引入
import { Button, Table } from "element-ui";
import "element-ui/lib/theme-chalk/button.css";
import "element-ui/lib/theme-chalk/table.css";
```

## 實戰效果

一個 Vue + Element UI 專案，最佳化前後對比：

```
最佳化前：vendor.js 1.2MB (gzip: 380KB)
- lodash 全量：74KB
- moment 全量：230KB
- Element UI 全量：500KB

最佳化後：vendor.js 380KB (gzip: 120KB)
- lodash-es 按需：8KB
- day.js：2KB
- Element UI 按需：180KB
```

## 小結

- Tree Shaking 依賴 ES Module，確保 Babel 不轉換模組語法
- `package.json` 的 `sideEffects` 欄位幫助 webpack 更激進地刪除程式碼
- 使用支援 ES Module 的庫（`lodash-es` 代替 `lodash`）
- 用 `webpack-bundle-analyzer` 驗證效果
