---
title: "前端模块化演进：从 CommonJS 到 ES Module"
date: 2018-01-23 15:20:10
tags:
  - 工程化
readingTime: 3
description: "前端模块化这条路走了将近十年。从最初没有模块系统，到各种规范百花齐放，再到 ES Module 标准化。理解这段历史能帮你看清楚现在的工具链为什么这么设计。"
wordCount: 583
---

前端模块化这条路走了将近十年。从最初没有模块系统，到各种规范百花齐放，再到 ES Module 标准化。理解这段历史能帮你看清楚现在的工具链为什么这么设计。

## 没有模块系统的年代

早期 JavaScript 没有原生的模块机制，所有代码都是全局的：

```html
<script src="jquery.js"></script>
<script src="plugin-a.js"></script>
<script src="plugin-b.js"></script>
<script src="app.js"></script>
```

问题很明显：

- 变量冲突（任何文件都能覆盖全局变量）
- 依赖顺序难以维护（必须按正确顺序引入）
- 难以做按需加载

## CommonJS（Node.js 生态）

2009 年，CommonJS 规范随 Node.js 出现：

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

// 解构
const { add } = require("./math");
```

特点：

- **同步加载**：适合 Node.js 的磁盘 I/O，不适合浏览器
- **动态**：`require` 可以写在条件语句或函数里
- **值拷贝**：`module.exports` 导出的是值的拷贝（原始值）或引用拷贝（对象）

## AMD（浏览器异步加载）

为了解决浏览器里异步加载的问题，AMD 规范（RequireJS 实现）出现了：

```javascript
// 定义模块
define("math", [], function () {
  return {
    add: function (a, b) {
      return a + b;
    },
  };
});

// 使用模块（异步加载）
require(["math", "utils"], function (math, utils) {
  console.log(math.add(1, 2));
});
```

AMD 在 SPA 时代曾经很流行，但写法冗长，随着 Webpack 的出现基本被取代了。

## ES Module：语言层面的标准

ES2015（ES6）终于在语言层面引入了模块系统：

```javascript
// math.js
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
export default { add, multiply }; // 默认导出

// main.js
import { add, multiply } from "./math";
import math from "./math"; // 导入默认导出
import * as mathUtils from "./math"; // 导入所有命名导出
```

**ES Module 和 CommonJS 的核心区别：**

```javascript
// CommonJS：值拷贝
// counter.js
let count = 0;
exports.count = count; // 导出的是当前值的拷贝
exports.increment = () => count++;

// main.js
const { count, increment } = require("./counter");
increment();
console.log(count); // 仍然是 0，拿到的是拷贝

// ES Module：实时绑定（live binding）
// counter.mjs
export let count = 0;
export function increment() {
  count++;
}

// main.mjs
import { count, increment } from "./counter.mjs";
increment();
console.log(count); // 1，实时反映变化
```

**静态结构**：ES Module 的 `import/export` 必须在顶层，不能放在条件语句里。这使得打包工具能在编译时静态分析依赖关系，实现 Tree Shaking。

## Tree Shaking：ES Module 的工程价值

Tree Shaking（摇树优化）依赖 ES Module 的静态结构：

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
// formatCurrency 和 formatPhone 从未使用
```

Webpack 和 Rollup 分析依赖图后，可以把未使用的 `formatCurrency` 和 `formatPhone` 从最终包里删除。

```javascript
// CommonJS 格式无法做 Tree Shaking
const utils = require("./utils");
// 打包工具无法确定 utils 的哪些属性会被用到
```

这就是为什么现代 npm 包要提供 ES Module 格式：`package.json` 里的 `module` 字段指向 ESM 版本：

```json
{
  "main": "dist/index.cjs.js", // CommonJS（Node.js 和老版本 Webpack）
  "module": "dist/index.esm.js", // ES Module（支持 Tree Shaking）
  "browser": "dist/index.umd.js" // UMD（直接在浏览器里用）
}
```

## 2018 年的现状

- **Node.js**：CommonJS 为主，ES Module 支持还在实验阶段（Node.js 9.6 开始，需要 `.mjs` 扩展名或 `--experimental-modules` flag）
- **浏览器**：Chrome 61、Safari 10.1、Firefox 54 已支持原生 `<script type="module">`，但生产环境还是通过 Webpack/Rollup 打包
- **日常开发**：写 ES Module 语法，Webpack + Babel 负责转换

```html
<!-- 原生 ES Module（现代浏览器，开发/演示用） -->
<script type="module" src="app.js"></script>
<!-- 降级方案（不支持 module 的浏览器） -->
<script nomodule src="app-legacy.js"></script>
```

这种 `module/nomodule` 模式是目前差异化服务现代/旧版浏览器的标准方案，现代浏览器加载更小的模块化包，旧浏览器加载带有所有 polyfill 的大包。

---

_下一篇：React 16 Fiber 架构解析_
