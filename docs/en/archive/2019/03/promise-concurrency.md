---
title: "JavaScript Promise Concurrency Control"
date: 2019-03-15 10:51:12
tags:
  - JavaScript
readingTime: 1
description: "Controlling JavaScript Promise concurrency is a problem developers encounter frequently in day-to-day work. Drawing from real projects, this article shares conc"
wordCount: 53
---

Controlling JavaScript Promise concurrency is a problem developers encounter frequently in day-to-day work. Drawing from real projects, this article shares concrete implementation approaches and lessons learned.

## The Basics

Here is the basic usage:

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

This approach is concise and clear, and works well for most scenarios.

## A Deeper Look

Here is the core code:

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
