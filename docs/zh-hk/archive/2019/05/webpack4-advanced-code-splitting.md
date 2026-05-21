---
title: "Webpack 4 Tree Shaking 原理深度解析"
date: 2019-05-22 10:35:50
tags:
  - Webpack
  - 工程化
readingTime: 6
description: "Tree Shaking 是 Webpack 4 中非常重要的優化手段，它能在打包時自動剔除未使用的代碼。但很多人配了 `mode: 'production'` 就以為完事了，實際上背後有很多值得深挖的原理。"
wordCount: 1027
---

Tree Shaking 是 Webpack 4 中非常重要的優化手段，它能在打包時自動剔除未使用的代碼。但很多人配了 `mode: 'production'` 就以為完事了，實際上背後有很多值得深挖的原理。

## 什麼是 Tree Shaking

Tree Shaking 這個名字來自"搖樹"——把樹上的枯葉搖下來。在 Webpack 語境下，"枯葉"就是模塊中導出了但從未被引用的代碼。

它的核心依賴一個前提：**ES Module 的靜態結構**。

```javascript
// math.js - 模塊導出了 add 和 subtract
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// app.js - 只使用了 add
import { add } from './math';

console.log(add(1, 2));
// subtract 沒有被任何地方引用 → 應該被移除
```

打包後，`subtract` 函數不應該出現在最終產物中。這就是 Tree Shaking 的目標。

## 為什麼 ESM 能做到，CommonJS 不行

這是最核心的問題。答案在於 **靜態分析**。

```javascript
// CommonJS - 動態加載，無法在編譯期確定導出了什麼
const math = require('./math');
math.add(1, 2);
// 問題：math 對象上到底有哪些屬性？
// 可能有 add，也可能通過 Object.defineProperty 動態添加
// 只有運行時才知道 → 無法做靜態分析

// 更極端的情況
const modules = require('./modules');
const name = getModuleName();
modules[name](); // 完全無法分析用了什麼
```

```javascript
// ESM - 靜態導入，編譯期就能確定依賴關係
import { add } from './math';
// 1. 導入的標識符在編譯期就確定了（不能放在 if 裏）
// 2. 模塊的導出也是靜態的（不能動態修改 export）
// 3. 模塊頂層執行，沒有條件分支幹擾
```

ESM 的 `import` / `export` 必須出現在模塊頂層，不能放在函數或條件語句裏，這讓 Webpack 可以在編譯階段就構建出完整的依賴圖。

## Webpack 4 中的 Tree Shaking 工作流程

Webpack 4 的 Tree Shaking 分兩個階段：**標記** 和 **刪除**。

### 階段一：標記（Export Usage Marking）

Webpack 在構建模塊圖之後，會遍歷所有模塊，標記哪些 `export` 被使用了，哪些沒有。

```javascript
// 假設有兩個文件

// utils.js
export function used() {      // ← 被標記為 "used"
  return 'I am used';
}

export function unused() {    // ← 被標記為 "unused"
  return 'I am not used';
}

// index.js
import { used } from './utils';
console.log(used());
```

Webpack 內部會為每個導出生成一個 **export info** 對象，記錄該導出是否被其他模塊引用。

```
Module: utils.js
  Export: "used"   → used: true  (被 index.js 引用)
  Export: "unused" → used: false (沒有任何模塊引用)
```

### 階段二：刪除（Dead Code Elimination）

標記完成後，Webpack 自身並不會直接刪除代碼。它會在生成的代碼中添加特殊標記，然後由 **壓縮工具**（UglifyJS 或 Terser）在壓縮階段實際移除未使用的代碼。

```javascript
// Webpack 生成的代碼大致如下（簡化示意）
// unused 函數會被標記，Terser 壓縮時看到這些標記，才會真正把 dead code 刪掉

// 生產環境中 Terser 配合 usedExports 信息：
// 1. Webpack 標記哪些導出未使用
// 2. Terser 的 dead_code elimination 移除未使用的代碼
```

所以 **Tree Shaking = Webpack 標記 + Terser 刪除**，兩者缺一不可。

## mode: 'production' 默認做了什麼

當你設置 `mode: 'production'` 時，Webpack 4 自動開啓了一系列優化：

```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  // 以下優化自動開啓：
  // 1. optimization.minimize: true        → 啓用壓縮
  // 2. optimization.minimizer: [Terser]   → 使用 Terser 壓縮
  // 3. optimization.usedExports: true     → 標記未使用的導出
  // 4. sideEffects 標記處理
};
```

如果用 `mode: 'development'` 也想看 Tree Shaking 效果，需要手動配置：

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'development',
  optimization: {
    usedExports: true,    // 標記哪些導出被使用了
    // development 模式下 minimize 默認關閉
    // 可以手動開啓來驗證 Tree Shaking 效果
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
        },
      }),
    ],
  },
};
```

## sideEffects 配置詳解

`sideEffects` 是 Webpack 4 新增的關鍵配置，它解決了一個重要問題：**有些模塊雖然沒有被直接引用，但它有副作用，不能隨便刪除**。

```javascript
// polyfill.js - 沒有導出任何東西，但修改了全局狀態
// 這就是 "side effect"（副作用）
if (!Array.prototype.flat) {
  Array.prototype.flat = function() {
    // polyfill 實現
  };
}

// index.js
import './polyfill';  // 沒有導入任何具名內容
// 但這個 import 不能被移除，因為它有副作用
```

### package.json 中配置 sideEffects

```json
{
  "name": "my-library",
  "sideEffects": false
}
```

`sideEffects: false` 告訴 Webpack："這個包的所有模塊都沒有副作用，如果某個導出沒被用到，放心刪。"

```json
{
  "name": "my-library",
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfill.js"
  ]
}
```

這種寫法更精細：只有列表中的文件有副作用（比如 CSS 文件通過 `import './style.css'` 引入，沒有導出但不能刪），其他模塊可以安全地 Tree Shaking。

### sideEffects 的工作原理

```javascript
// 假設 lodash-es 的 package.json 聲明瞭 sideEffects: false

// lodash-es/debounce.js
export default function debounce(func, wait) { /* ... */ }
export function debounceLeading(func, wait) { /* ... */ }

// app.js
import debounce from 'lodash-es/debounce';

// Webpack 分析：
// 1. debounce.js 聲明瞭 sideEffects: false
// 2. app.js 只導入了 default 導出
// 3. debounceLeading 未被使用 → 標記為 unused export
// 4. Terser 壓縮時移除 debounceLeading
```

這也是為什麼 **lodash-es**（ESM 版本）比 **lodash**（CommonJS 版本）更適合 Tree Shaking。

## UglifyJS 與 Terser

Webpack 4 默認使用 UglifyJS 作為壓縮工具，但社區正在遷移到 **Terser**，因為 UglifyJS 不支持 ES6+ 語法。

```javascript
// webpack 4 默認使用 UglifyJsPlugin
// 如果代碼包含 ES6+ 語法，UglifyJS 會報錯

// 切換到 Terser：
// npm install --save-dev terser-webpack-plugin

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            unused: true,        // 移除未使用的變量
            dead_code: true,     // 移除不可達代碼
            pure_funcs: [        // 移除指定的純函數調用
              'console.log',
              'console.debug',
            ],
          },
          output: {
            comments: false,     // 移除註釋
          },
        },
        parallel: true,          // 多線程壓縮
      }),
    ],
  },
};
```

Terser 和 UglifyJS 在 Tree Shaking 中的角色相同：接收 Webpack 標記的信息，執行 dead code elimination。區別在於 Terser 原生支持 ES6+ 語法，是當前推薦的選擇。

## 常見的 Tree Shaking 失效場景

### 場景一：Babel 把 ESM 轉成了 CommonJS

這是最常見的坑。如果你的 Babel 配置把模塊語法轉成了 CommonJS，Tree Shaking 就失效了。

```javascript
// .babelrc（錯誤配置）
{
  "presets": [
    ["@babel/preset-env", {
      "modules": "commonjs"  // ← 這會把 ESM 轉成 CommonJS
    }]
  ]
}

// Babel 轉換後：
// import { add } from './math'
// ↓ 變成了
var _math = require("./math");
(0, _math.add)(1, 2);
// 現在 Webpack 看到的是 CommonJS，無法 Tree Shaking
```

修復方法：讓 Babel 不轉模塊語法，交給 Webpack 處理。

```javascript
// .babelrc（正確配置）
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // ← 不轉換模塊語法，保留 ESM
    }]
  ]
}
```

### 場景二：使用了有副作用的導入

```javascript
// 沒有配置 sideEffects，且模塊確實有副作用
// Webpack 不確定能不能刪，保守起見保留了所有代碼
import { Button } from 'antd';
// 如果 antd 沒有配置 sideEffects: false
// Button 的所有依賴都會被打包，即使你只用了 Button
```

### 場景三：對象屬性訪問的導出

```javascript
// math.js
export const math = {
  add(a, b) { return a + b; },
  subtract(a, b) { return a - b; },
};

// app.js
import { math } from './math';
console.log(math.add(1, 2));
// 問題：math 是一個對象，整個對象都被使用了
// subtract 作為 math 的屬性，Webpack 無法判斷是否被使用
// Tree Shaking 對這種寫法無能為力
```

正確的做法是使用具名導出：

```javascript
// math.js - 正確方式
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }

// app.js
import { add } from './math';
console.log(add(1, 2));
// 現在 subtract 可以被 Tree Shaking 了
```

## 完整的配置示例

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    filename: '[name].[contenthash:8].js',
    path: __dirname + '/dist',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                modules: false,  // 關鍵：不轉換 ESM
                targets: '> 0.25%, not dead',
              }],
            ],
          },
        },
      },
      // CSS 文件需要標記為 sideEffect
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  optimization: {
    usedExports: true,        // 標記未使用的導出
    minimize: true,           // 啓用壓縮
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            pure_funcs: ['console.log'], // 刪除 console.log 調用
          },
        },
      }),
    ],
    concatenateModules: true, // scope hoisting，有助於 Tree Shaking
  },
};
```

對應的 `package.json`：

```json
{
  "name": "my-app",
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

## 驗證 Tree Shaking 是否生效

最直觀的方式是查看 Webpack 的分析輸出：

```bash
# 方法一：使用 webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer

# 在 webpack.config.js 中添加
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin(),
  ],
};

# 構建後自動打開分析頁面，檢查模塊是否被正確移除
```

```bash
# 方法二：使用 --json 參數輸出構建信息
npx webpack --json > stats.json

# 搜索 unused export 相關的標記
```

還有一個小技巧：在 `package.json` 中不配置 `sideEffects` 時，Webpack 會輸出警告提示哪些模塊可能需要配置。

## 小結

- Tree Shaking 的基礎是 ESM 的靜態結構，CommonJS 無法做 Tree Shaking
- Webpack 4 的 Tree Shaking 分兩步：`usedExports` 標記 + Terser 刪除，兩者缺一不可
- `sideEffects` 是關鍵配置，告訴 Webpack 哪些模塊可以安全刪除
- Babel 的 `modules: false` 配置非常重要，否則 ESM 會被轉成 CommonJS 導致 Tree Shaking 失效
- 避免使用"整個對象導出"的模式，優先使用具名導出
- 生產環境 `mode: 'production'` 默認開啓這些優化，但理解原理才能排查問題
