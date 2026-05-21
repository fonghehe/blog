---
title: "JavaScript Promise並行制御"
date: 2019-03-15 10:51:12
tags:
  - JavaScript
readingTime: 1
description: "JavaScriptのPromise並行制御は、日常の開発でよく遭遇する問題だ。実際のプロジェクトから出発して、具体的な実装方法と経験をまとめる。"
wordCount: 118
---

JavaScriptのPromise並行制御は、日常の開発でよく遭遇する問題だ。実際のプロジェクトから出発して、具体的な実装方法と経験をまとめる。

## 基本概念

まず基本的な使い方を見てみよう：

```javascript
const http = require("http");
const cluster = require("cluster");
const os = require("os");

if (cluster.isMaster) {
  const numWorkers = os.cpus().length;
  console.log(`主进程 ${process.pid}，启动 ${numWorkers} 个 worker`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} 退出，重启中`);
    cluster.fork();
  });
} else {
  http
    .createServer((req, res) => {
      res.end(`Worker ${process.pid}`);
    })
    .listen(3000);
}
```

この書き方はシンプルで明快で、ほとんどのシナリオに適している。

## 深掘り

コアコードは以下の通り：

```javascript
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader'
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors'
        }
      }
    }
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
```
