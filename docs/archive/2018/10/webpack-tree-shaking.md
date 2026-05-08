---
title: "Webpack Tree Shaking 原理和实践"
date: 2018-10-06 10:55:15
tags:
  - Webpack
  - 工程化
---

`tree-shaking` 这个词来自 Rollup，意思是把没用到的代码像树叶一样"抖掉"。Webpack 2 开始支持，但要正确配置才生效。

## 基本原理

Tree shaking 依赖 ES module 的**静态结构**（import/export 在编译时就确定，不能动态改变）：

```javascript
// ES module：静态，可以分析
import { add } from "./math"; // 只用了 add
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
} // 没被导入，可以移除

// CommonJS：动态，无法分析
const math = require("./math"); // 整个对象都被引入，无法判断用了哪些
const method = "add";
math[method](); // 动态访问，tree shaking 不知道哪些方法会被用到
```

## 生效条件

```
1. 源代码使用 ES module（import/export）
2. webpack mode 为 production
3. 不要用 babel 把 ES module 转为 CommonJS
4. package.json 的 sideEffects 配置正确
```

## 配置 Babel 不转 CommonJS

```javascript
// .babelrc 或 babel.config.js
{
  "presets": [
    ["@babel/preset-env", {
      "modules": false  // 关键！不要转 CommonJS
    }]
  ]
}
```

## sideEffects 配置

Webpack 需要知道哪些文件有副作用（如 CSS、polyfill），不能被 tree-shaken：

```json
// package.json
{
  // 所有文件都没有副作用，可以安全 tree-shake
  "sideEffects": false,

  // 或者列出有副作用的文件
  "sideEffects": ["*.css", "*.scss", "./src/polyfills.js"]
}
```

## 验证 Tree Shaking 是否生效

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
} // 我们不用这个

// main.js
import { add } from "./math";
console.log(add(1, 2));
```

生产构建后，`multiply` 应该不在 bundle 里。用 `webpack-bundle-analyzer` 验证。

## 常见问题

**问题一：第三方库没有 ES module 版本**

```javascript
// lodash 是 CommonJS，tree shaking 不生效
import { debounce } from "lodash"; // 会打包整个 lodash！

// 解决：用 lodash-es（ES module 版本）
import { debounce } from "lodash-es"; // ✅ 只打包 debounce

// 或者按路径引入
import debounce from "lodash/debounce"; // ✅ 也可以
```

**问题二：类的副作用**

```javascript
// 类方法通常不能被 tree-shaking（因为可能有副作用）
class Utils {
  static add(a, b) {
    return a + b;
  }
  static multiply(a, b) {
    return a * b;
  } // 即使没用也可能被打进去
}

// 改成函数导出，tree-shaking 效果更好
export function add(a, b) {
  return a + b;
}
export function multiply(a, b) {
  return a * b;
}
```

## 效果

在我们项目里，用了 lodash-es 并修复 sideEffects 配置之后：

```
lodash：从 70KB 降到 8KB（按实际使用）
整体 bundle：减少约 120KB（gzip 后约 40KB）
```

## 小结

- Tree shaking 依赖 ES module 静态结构
- Babel 不要把 ES module 转 CommonJS（`modules: false`）
- 配置 `sideEffects` 告知哪些文件不可 tree-shake
- 第三方库优先选有 ES module 版本的（如 lodash-es）
