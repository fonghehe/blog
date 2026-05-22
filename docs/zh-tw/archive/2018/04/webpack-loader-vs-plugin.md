---
title: "Webpack loader 和 plugin 的區別"
date: 2018-04-27 10:45:43
tags:
  - Webpack
readingTime: 1
description: "Webpack 設定裡 `module.rules`（loader）和 `plugins` 是兩個最重要的設定項，但很多人搞不清楚它們的區別。"
wordCount: 143
---

Webpack 配置裡 `module.rules`（loader）和 `plugins` 是兩個最重要的配置項，但很多人搞不清楚它們的區別。

## 核心區別

```
Loader：檔案轉換器
  - 作用於單個檔案
  - 把 A 型別檔案轉成 Webpack 能理解的 JS 模組
  - 在 import/require 時觸發

Plugin：構建過程擴充套件
  - 作用於整個構建流程
  - 監聽 Webpack 的生命週期事件，在合適的時機做額外的事情
  - 功能更強大，但配置也更復雜
```

## Loader：檔案轉換

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader", // .vue 檔案 → JS 模組
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader", // TypeScript → JS
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader", // 3. 把 CSS 注入 DOM
          "css-loader", // 2. 處理 @import 和 url()
          "sass-loader", // 1. SCSS → CSS（從右到左執行）
        ],
      },
      {
        test: /\.(png|jpg|gif)$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 8192, // 小於 8KB 轉成 base64
          },
        },
      },
    ],
  },
};
```

Loader 的執行順序是**從右到左、從下到上**：

```javascript
use: ["style-loader", "css-loader", "sass-loader"];
// 執行順序：sass-loader → css-loader → style-loader
```

## Plugin：構建增強

```javascript
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const webpack = require("webpack");

module.exports = {
  plugins: [
    // 自動生成 HTML，並注入 script 標籤
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      filename: "index.html",
    }),

    // 把 CSS 提取成獨立檔案（而不是注入 <style>）
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash:8].css",
    }),

    // 分析 bundle 大小（隻在需要時開啟）
    process.env.ANALYZE && new BundleAnalyzerPlugin(),

    // 定義全域性常量
    new webpack.DefinePlugin({
      "process.env.API_URL": JSON.stringify(process.env.API_URL),
    }),
  ].filter(Boolean),
};
```

## 自己寫一個簡單的 Loader

```javascript
// my-loader.js
module.exports = function (source) {
  // source：檔案的原始內容（字串）
  // 返回：轉換後的內容

  // 例：把檔案裡所有 console.log 去掉
  return source.replace(/console\.log\(.*?\);?\n?/g, "");
};
```

## 自己寫一個簡單的 Plugin

```javascript
class BuildTimePlugin {
  apply(compiler) {
    // 監聽 done（構建完成）事件
    compiler.hooks.done.tap("BuildTimePlugin", (stats) => {
      const time = stats.endTime - stats.startTime;
      console.log(`\n構建耗時：${time}ms\n`);
    });
  }
}

module.exports = BuildTimePlugin;
```

## 小結

|          | Loader           | Plugin                          |
| 
-------- | ---------------- | ------------------------------- |
| 作用範圍 | 單個檔案         | 整個構建流程                    |
| 觸發時機 | 檔案被 import 時 | Webpack 生命週期鉤子            |
| 配置位置 | `module.rules`   | `plugins` 陣列                  |
| 典型用途 | 檔案型別轉換     | 壓縮、拆包、生成 HTML、注入變數 |