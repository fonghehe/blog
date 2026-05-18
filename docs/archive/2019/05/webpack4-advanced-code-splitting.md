---
title: "Webpack 4 Tree Shaking 原理深度解析"
date: 2019-05-22 10:35:50
tags:
  - Webpack
  - 工程化
readingTime: 6
description: "Tree Shaking 是 Webpack 4 中非常重要的优化手段，它能在打包时自动剔除未使用的代码。但很多人配了 `mode: 'production'` 就以为完事了，实际上背后有很多值得深挖的原理。"
---

Tree Shaking 是 Webpack 4 中非常重要的优化手段，它能在打包时自动剔除未使用的代码。但很多人配了 `mode: 'production'` 就以为完事了，实际上背后有很多值得深挖的原理。

## 什么是 Tree Shaking

Tree Shaking 这个名字来自"摇树"——把树上的枯叶摇下来。在 Webpack 语境下，"枯叶"就是模块中导出了但从未被引用的代码。

它的核心依赖一个前提：**ES Module 的静态结构**。

```javascript
// math.js - 模块导出了 add 和 subtract
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// app.js - 只使用了 add
import { add } from './math';

console.log(add(1, 2));
// subtract 没有被任何地方引用 → 应该被移除
```

打包后，`subtract` 函数不应该出现在最终产物中。这就是 Tree Shaking 的目标。

## 为什么 ESM 能做到，CommonJS 不行

这是最核心的问题。答案在于 **静态分析**。

```javascript
// CommonJS - 动态加载，无法在编译期确定导出了什么
const math = require('./math');
math.add(1, 2);
// 问题：math 对象上到底有哪些属性？
// 可能有 add，也可能通过 Object.defineProperty 动态添加
// 只有运行时才知道 → 无法做静态分析

// 更极端的情况
const modules = require('./modules');
const name = getModuleName();
modules[name](); // 完全无法分析用了什么
```

```javascript
// ESM - 静态导入，编译期就能确定依赖关系
import { add } from './math';
// 1. 导入的标识符在编译期就确定了（不能放在 if 里）
// 2. 模块的导出也是静态的（不能动态修改 export）
// 3. 模块顶层执行，没有条件分支干扰
```

ESM 的 `import` / `export` 必须出现在模块顶层，不能放在函数或条件语句里，这让 Webpack 可以在编译阶段就构建出完整的依赖图。

## Webpack 4 中的 Tree Shaking 工作流程

Webpack 4 的 Tree Shaking 分两个阶段：**标记** 和 **删除**。

### 阶段一：标记（Export Usage Marking）

Webpack 在构建模块图之后，会遍历所有模块，标记哪些 `export` 被使用了，哪些没有。

```javascript
// 假设有两个文件

// utils.js
export function used() {      // ← 被标记为 "used"
  return 'I am used';
}

export function unused() {    // ← 被标记为 "unused"
  return 'I am not used';
}

// index.js
import { used } from './utils';
console.log(used());
```

Webpack 内部会为每个导出生成一个 **export info** 对象，记录该导出是否被其他模块引用。

```
Module: utils.js
  Export: "used"   → used: true  (被 index.js 引用)
  Export: "unused" → used: false (没有任何模块引用)
```

### 阶段二：删除（Dead Code Elimination）

标记完成后，Webpack 自身并不会直接删除代码。它会在生成的代码中添加特殊标记，然后由 **压缩工具**（UglifyJS 或 Terser）在压缩阶段实际移除未使用的代码。

```javascript
// Webpack 生成的代码大致如下（简化示意）
// unused 函数会被标记，Terser 压缩时看到这些标记，才会真正把 dead code 删掉

// 生产环境中 Terser 配合 usedExports 信息：
// 1. Webpack 标记哪些导出未使用
// 2. Terser 的 dead_code elimination 移除未使用的代码
```

所以 **Tree Shaking = Webpack 标记 + Terser 删除**，两者缺一不可。

## mode: 'production' 默认做了什么

当你设置 `mode: 'production'` 时，Webpack 4 自动开启了一系列优化：

```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  // 以下优化自动开启：
  // 1. optimization.minimize: true        → 启用压缩
  // 2. optimization.minimizer: [Terser]   → 使用 Terser 压缩
  // 3. optimization.usedExports: true     → 标记未使用的导出
  // 4. sideEffects 标记处理
};
```

如果用 `mode: 'development'` 也想看 Tree Shaking 效果，需要手动配置：

```javascript
// webpack.config.js
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'development',
  optimization: {
    usedExports: true,    // 标记哪些导出被使用了
    // development 模式下 minimize 默认关闭
    // 可以手动开启来验证 Tree Shaking 效果
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

## sideEffects 配置详解

`sideEffects` 是 Webpack 4 新增的关键配置，它解决了一个重要问题：**有些模块虽然没有被直接引用，但它有副作用，不能随便删除**。

```javascript
// polyfill.js - 没有导出任何东西，但修改了全局状态
// 这就是 "side effect"（副作用）
if (!Array.prototype.flat) {
  Array.prototype.flat = function() {
    // polyfill 实现
  };
}

// index.js
import './polyfill';  // 没有导入任何具名内容
// 但这个 import 不能被移除，因为它有副作用
```

### package.json 中配置 sideEffects

```json
{
  "name": "my-library",
  "sideEffects": false
}
```

`sideEffects: false` 告诉 Webpack："这个包的所有模块都没有副作用，如果某个导出没被用到，放心删。"

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

这种写法更精细：只有列表中的文件有副作用（比如 CSS 文件通过 `import './style.css'` 引入，没有导出但不能删），其他模块可以安全地 Tree Shaking。

### sideEffects 的工作原理

```javascript
// 假设 lodash-es 的 package.json 声明了 sideEffects: false

// lodash-es/debounce.js
export default function debounce(func, wait) { /* ... */ }
export function debounceLeading(func, wait) { /* ... */ }

// app.js
import debounce from 'lodash-es/debounce';

// Webpack 分析：
// 1. debounce.js 声明了 sideEffects: false
// 2. app.js 只导入了 default 导出
// 3. debounceLeading 未被使用 → 标记为 unused export
// 4. Terser 压缩时移除 debounceLeading
```

这也是为什么 **lodash-es**（ESM 版本）比 **lodash**（CommonJS 版本）更适合 Tree Shaking。

## UglifyJS 与 Terser

Webpack 4 默认使用 UglifyJS 作为压缩工具，但社区正在迁移到 **Terser**，因为 UglifyJS 不支持 ES6+ 语法。

```javascript
// webpack 4 默认使用 UglifyJsPlugin
// 如果代码包含 ES6+ 语法，UglifyJS 会报错

// 切换到 Terser：
// npm install --save-dev terser-webpack-plugin

const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            unused: true,        // 移除未使用的变量
            dead_code: true,     // 移除不可达代码
            pure_funcs: [        // 移除指定的纯函数调用
              'console.log',
              'console.debug',
            ],
          },
          output: {
            comments: false,     // 移除注释
          },
        },
        parallel: true,          // 多线程压缩
      }),
    ],
  },
};
```

Terser 和 UglifyJS 在 Tree Shaking 中的角色相同：接收 Webpack 标记的信息，执行 dead code elimination。区别在于 Terser 原生支持 ES6+ 语法，是当前推荐的选择。

## 常见的 Tree Shaking 失效场景

### 场景一：Babel 把 ESM 转成了 CommonJS

这是最常见的坑。如果你的 Babel 配置把模块语法转成了 CommonJS，Tree Shaking 就失效了。

```javascript
// .babelrc（错误配置）
{
  "presets": [
    ["@babel/preset-env", {
      "modules": "commonjs"  // ← 这会把 ESM 转成 CommonJS
    }]
  ]
}

// Babel 转换后：
// import { add } from './math'
// ↓ 变成了
var _math = require("./math");
(0, _math.add)(1, 2);
// 现在 Webpack 看到的是 CommonJS，无法 Tree Shaking
```

修复方法：让 Babel 不转模块语法，交给 Webpack 处理。

```javascript
// .babelrc（正确配置）
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // ← 不转换模块语法，保留 ESM
    }]
  ]
}
```

### 场景二：使用了有副作用的导入

```javascript
// 没有配置 sideEffects，且模块确实有副作用
// Webpack 不确定能不能删，保守起见保留了所有代码
import { Button } from 'antd';
// 如果 antd 没有配置 sideEffects: false
// Button 的所有依赖都会被打包，即使你只用了 Button
```

### 场景三：对象属性访问的导出

```javascript
// math.js
export const math = {
  add(a, b) { return a + b; },
  subtract(a, b) { return a - b; },
};

// app.js
import { math } from './math';
console.log(math.add(1, 2));
// 问题：math 是一个对象，整个对象都被使用了
// subtract 作为 math 的属性，Webpack 无法判断是否被使用
// Tree Shaking 对这种写法无能为力
```

正确的做法是使用具名导出：

```javascript
// math.js - 正确方式
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }

// app.js
import { add } from './math';
console.log(add(1, 2));
// 现在 subtract 可以被 Tree Shaking 了
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
                modules: false,  // 关键：不转换 ESM
                targets: '> 0.25%, not dead',
              }],
            ],
          },
        },
      },
      // CSS 文件需要标记为 sideEffect
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  optimization: {
    usedExports: true,        // 标记未使用的导出
    minimize: true,           // 启用压缩
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            pure_funcs: ['console.log'], // 删除 console.log 调用
          },
        },
      }),
    ],
    concatenateModules: true, // scope hoisting，有助于 Tree Shaking
  },
};
```

对应的 `package.json`：

```json
{
  "name": "my-app",
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

## 验证 Tree Shaking 是否生效

最直观的方式是查看 Webpack 的分析输出：

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

# 构建后自动打开分析页面，检查模块是否被正确移除
```

```bash
# 方法二：使用 --json 参数输出构建信息
npx webpack --json > stats.json

# 搜索 unused export 相关的标记
```

还有一个小技巧：在 `package.json` 中不配置 `sideEffects` 时，Webpack 会输出警告提示哪些模块可能需要配置。

## 小结

- Tree Shaking 的基础是 ESM 的静态结构，CommonJS 无法做 Tree Shaking
- Webpack 4 的 Tree Shaking 分两步：`usedExports` 标记 + Terser 删除，两者缺一不可
- `sideEffects` 是关键配置，告诉 Webpack 哪些模块可以安全删除
- Babel 的 `modules: false` 配置非常重要，否则 ESM 会被转成 CommonJS 导致 Tree Shaking 失效
- 避免使用"整个对象导出"的模式，优先使用具名导出
- 生产环境 `mode: 'production'` 默认开启这些优化，但理解原理才能排查问题
