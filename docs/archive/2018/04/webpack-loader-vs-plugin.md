---
title: "Webpack loader 和 plugin 的区别"
date: 2018-04-27 10:45:43
tags:
  - Webpack
readingTime: 1
description: "Webpack 配置里 `module.rules`（loader）和 `plugins` 是两个最重要的配置项，但很多人搞不清楚它们的区别。"
---

Webpack 配置里 `module.rules`（loader）和 `plugins` 是两个最重要的配置项，但很多人搞不清楚它们的区别。

## 核心区别

```
Loader：文件转换器
  - 作用于单个文件
  - 把 A 类型文件转成 Webpack 能理解的 JS 模块
  - 在 import/require 时触发

Plugin：构建过程扩展
  - 作用于整个构建流程
  - 监听 Webpack 的生命周期事件，在合适的时机做额外的事情
  - 功能更强大，但配置也更复杂
```

## Loader：文件转换

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader", // .vue 文件 → JS 模块
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader", // TypeScript → JS
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader", // 3. 把 CSS 注入 DOM
          "css-loader", // 2. 处理 @import 和 url()
          "sass-loader", // 1. SCSS → CSS（从右到左执行）
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 8192, // 小于 8KB 转成 base64
          },
        },
      },
    ],
  },
};
```

Loader 的执行顺序是**从右到左、从下到上**：

```javascript
use: ["style-loader", "css-loader", "sass-loader"];
// 执行顺序：sass-loader → css-loader → style-loader
```

## Plugin：构建增强

```javascript
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const webpack = require("webpack");

module.exports = {
  plugins: [
    // 自动生成 HTML，并注入 script 标签
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
    }),

    // 把 CSS 提取成独立文件（而不是注入 <style>）
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].css",
    }),

    // 分析 bundle 大小（只在需要时开启）
    process.env.ANALYZE && new BundleAnalyzerPlugin(),

    // 定义全局常量
    new webpack.DefinePlugin({
      "process.env.API_URL": JSON.stringify(process.env.API_URL),
    }),
  ].filter(Boolean),
};
```

## 自己写一个简单的 Loader

```javascript
// my-loader.js
module.exports = function (source) {
  // source：文件的原始内容（字符串）
  // 返回：转换后的内容

  // 例：把文件里所有 console.log 去掉
  return source.replace(/console\.log\(.*?\);?\n?/g, "");
};
```

## 自己写一个简单的 Plugin

```javascript
class BuildTimePlugin {
  apply(compiler) {
    // 监听 done（构建完成）事件
    compiler.hooks.done.tap("BuildTimePlugin", (stats) => {
      const time = stats.endTime - stats.startTime;
      console.log(`\n构建耗时：${time}ms\n`);
    });
  }
}

module.exports = BuildTimePlugin;
```

## 小结

|          | Loader           | Plugin                          |
| 
-------- | ---------------- | ------------------------------- |
| 作用范围 | 单个文件         | 整个构建流程                    |
| 触发时机 | 文件被 import 时 | Webpack 生命周期钩子            |
| 配置位置 | `module.rules`   | `plugins` 数组                  |
| 典型用途 | 文件类型转换     | 压缩、拆包、生成 HTML、注入变量 |