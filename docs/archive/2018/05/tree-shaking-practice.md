---
title: "前端性能优化：Tree Shaking 深度实践"
date: 2018-05-29 15:51:05
tags:
  - 前端
---

Tree Shaking 是现代前端工程的重要优化手段，但实际效果经常不如预期，背后原因值得深究。

## Tree Shaking 是什么

Tree Shaking 利用 ES Module 的静态特性，在打包时删除没有被使用的代码（dead code elimination）：

```javascript
// utils.js
export function add(a, b) {
  return a + b;
}
export function subtract(a, b) {
  return a - b;
} // 没被使用

// main.js
import { add } from "./utils";
console.log(add(1, 2));
// subtract 从未被 import，Tree Shaking 后不会出现在 bundle 里
```

**前提条件**：必须使用 ES Module（`import/export`），CommonJS（`require`）无法 Tree Shaking。

## 为什么有时 Tree Shaking 不生效

### 原因 1：使用了 CommonJS 模块

```javascript
// ❌ CommonJS，无法 Tree Shaking
const { add } = require("./utils");

// ✅ ES Module
import { add } from "./utils";
```

Babel 7 之前会把 ES Module 转成 CommonJS（`@babel/preset-env` 的默认行为），导致 Tree Shaking 失效。

**修复：**

```javascript
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false, // 不转换 ES Module，让 webpack 处理
      },
    ],
  ],
};
```

### 原因 2：副作用（Side Effects）

如果模块有副作用（执行时修改了全局状态），Tree Shaking 会保守地保留它：

```javascript
// 有副作用的模块：执行时修改了全局
window.myLib = { version: '1.0' }
export function doSomething() { ... }
```

在 `package.json` 声明哪些文件有副作用：

```json
{
  "sideEffects": [
    "*.css", // CSS 文件有副作用（全局样式）
    "src/polyfills.js"
  ]
}
```

或者声明完全没有副作用：

```json
{
  "sideEffects": false
}
```

### 原因 3：引入方式错误

```javascript
// ❌ 导入整个包
import _ from "lodash";
_.chunk([1, 2, 3, 4], 2); // 整个 lodash 都被打包

// ✅ 导入具体函数
import chunk from "lodash/chunk";

// ✅ 使用 lodash-es（ES Module 版本）
import { chunk } from "lodash-es";
```

### 原因 4：对象解构导入

```javascript
// ❌ 看起来像按需导入，但实际上导入了整个 module
import * as utils from "./utils";
const { add } = utils;

// ✅ 直接命名导入
import { add } from "./utils";
```

## 验证 Tree Shaking 效果

```javascript
// 构建后检查 bundle 里是否还有 "subtract" 字符串
// 如果 Tree Shaking 生效，已删除的函数名不应该出现
grep -r "subtract" dist/
```

或者用 `webpack-bundle-analyzer` 可视化查看。

## 第三方库的 Tree Shaking

只有提供 ES Module 的库才支持 Tree Shaking：

| 库           | Tree Shaking 支持           |
| ------------ | --------------------------- |
| `lodash`     | ❌ CommonJS                 |
| `lodash-es`  | ✅ ES Module                |
| `vue`        | ✅（2.6+）                  |
| `element-ui` | 需要 babel-plugin-component |
| `date-fns`   | ✅ ES Module                |
| `moment`     | ❌ 建议换 day.js            |

## Element UI 的 Tree Shaking

```javascript
// 方法一：babel-plugin-component（自动按需引入）
// babel.config.js
{
  plugins: [
    [
      "component",
      { libraryName: "element-ui", styleLibraryName: "theme-chalk" },
    ],
  ];
}

// 方法二：手动按需引入
import { Button, Table } from "element-ui";
import "element-ui/lib/theme-chalk/button.css";
import "element-ui/lib/theme-chalk/table.css";
```

## 实战效果

一个 Vue + Element UI 项目，优化前后对比：

```
优化前：vendor.js 1.2MB (gzip: 380KB)
- lodash 全量：74KB
- moment 全量：230KB
- Element UI 全量：500KB

优化后：vendor.js 380KB (gzip: 120KB)
- lodash-es 按需：8KB
- day.js：2KB
- Element UI 按需：180KB
```

## 小结

- Tree Shaking 依赖 ES Module，确保 Babel 不转换模块语法
- `package.json` 的 `sideEffects` 字段帮助 webpack 更激进地删除代码
- 使用支持 ES Module 的库（`lodash-es` 代替 `lodash`）
- 用 `webpack-bundle-analyzer` 验证效果
