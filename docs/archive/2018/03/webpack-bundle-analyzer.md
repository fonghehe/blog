---
title: "webpack-bundle-analyzer 打包分析实战"
date: 2018-03-10 16:56:12
tags:
  - Webpack
  - 工程化
readingTime: 2
description: "项目打包完发现 vendor.js 有 3MB，加载慢，但不知道哪些库占了大头。`webpack-bundle-analyzer` 是这种问题的标准工具。"
wordCount: 377
---

项目打包完发现 vendor.js 有 3MB，加载慢，但不知道哪些库占了大头。`webpack-bundle-analyzer` 是这种问题的标准工具。

## 安装和配置

```bash
npm install --save-dev webpack-bundle-analyzer
```

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: "server", // 启动分析服务器，默认 8888 端口
      openAnalyzer: true, // 自动打开浏览器
      // analyzerMode: 'static', // 生成静态 HTML 报告
      // reportFilename: 'report.html'
    }),
  ],
};
```

为了不影响日常开发，只在需要分析时启用：

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "analyze": "ANALYZE=true webpack --mode production"
  }
}
```

```javascript
// webpack.config.js
const analyze = process.env.ANALYZE;

module.exports = {
  plugins: [analyze && new BundleAnalyzerPlugin()].filter(Boolean),
};
```

## 读懂分析报告

打开报告后，看到一个矩形树图：

- **面积大小** = 文件体积（gzip 前）
- **颜色深浅** = 包含的模块数量
- **可点击展开** = 查看包含的具体模块

重点关注：

1. `node_modules` 里哪些库最大
2. 有没有重复打包的模块
3. 自己写的业务代码有没有异常大的

## 常见优化点

### 1. lodash 整包被打包

```javascript
// ❌ 这会打包整个 lodash（71KB gzip）
import _ from "lodash";
const result = _.chunk([1, 2, 3, 4], 2);

// ✅ 只引入需要的函数（单独的 lodash 函数包只有几 KB）
import chunk from "lodash/chunk";
const result = chunk([1, 2, 3, 4], 2);

// 或者安装 lodash-es（Tree-shaking 友好）
import { chunk } from "lodash-es";
```

### 2. moment.js 的语言包

moment.js 默认会打包所有语言包（约 160KB），实际项目通常只用中文：

```javascript
// webpack.config.js
const webpack = require("webpack");

module.exports = {
  plugins: [
    // 只保留中文和英文
    new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn|en/),
  ],
};
```

或者直接换成 `day.js`（只有 2KB，API 基本兼容）。

### 3. Element UI 按需加载

```bash
npm install babel-plugin-component
```

```json
// .babelrc
{
  "plugins": [
    [
      "component",
      {
        "libraryName": "element-ui",
        "styleLibraryName": "theme-chalk"
      }
    ]
  ]
}
```

```javascript
// ❌ 全量引入（约 500KB）
import ElementUI from "element-ui";
Vue.use(ElementUI);

// ✅ 按需引入（只打包用到的组件）
import { Button, Table, Form, Input } from "element-ui";
Vue.use(Button);
Vue.use(Table);
```

### 4. 路由懒加载

```javascript
// ❌ 全部打包到主 bundle
import HomePage from "@/pages/HomePage";
import AboutPage from "@/pages/AboutPage";

// ✅ 按需加载
const HomePage = () => import("@/pages/HomePage");
const AboutPage = () => import("@/pages/AboutPage");

// 相关路由合并成一个 chunk
const UserProfile = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserProfile");
const UserSettings = () =>
  import(/* webpackChunkName: "user" */ "@/pages/UserSettings");
```

### 5. 使用 CDN 外链

```javascript
// webpack.config.js
module.exports = {
  externals: {
    vue: "Vue",
    "element-ui": "ELEMENT",
    echarts: "echarts",
  },
};
```

```html
<!-- index.html - 从 CDN 加载 -->
<script src="https://cdn.jsdelivr.net/npm/vue@2.5.21/dist/vue.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/element-ui@2.4.11/lib/index.js"></script>
```

## 一次真实优化记录

| 优化项               | 优化前    | 优化后    |
| 
-------------------- | --------- | --------- |
| 全量 lodash → 按需   | 71KB      | 3KB       |
| 全量 moment → day.js | 230KB     | 2KB       |
| Element UI 按需加载  | 500KB     | 200KB     |
| 路由懒加载           | 首屏全部  | 按需加载  |
| **总体积**           | **1.8MB** | **680KB** |

gzip 之后进一步压缩约 70%，最终首屏 JS 从 540KB 降到约 200KB。

## 小结

- 先用 `webpack-bundle-analyzer` 可视化找到问题
- lodash/moment 是常见的体积大户，针对性处理
- UI 库按需加载收益显著
- 路由懒加载对首屏体验提升很大
- 不要盲目优化，先测量再行动
