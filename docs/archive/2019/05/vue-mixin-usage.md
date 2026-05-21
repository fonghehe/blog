---
title: "Vue 2 Mixin 使用与陷阱"
date: 2019-05-07 17:00:41
tags:
  - Vue
readingTime: 1
description: "很多同学在Vue 2 Mixin 使用与陷阱上存在理解偏差，本文系统地梳理核心要点和常见误区。"
wordCount: 193
---

很多同学在Vue 2 Mixin 使用与陷阱上存在理解偏差，本文系统地梳理核心要点和常见误区。

## 基础用法

我们可以通过以下方式实现：

```javascript
const express = require('express')
const app = express()

// 中间件
app.use(express.json())

function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? '服务器错误' : err.message
  })
}

app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find()
    res.json(users)
  } catch (err) {
    next(err)
  }
})

app.use(errorHandler)
```

注意上面代码中的性能细节，避免不必要的计算。

## 进阶技巧

具体实现参考以下代码：

```javascript
const http = require('http')
const cluster = require('cluster')
const os = require('os')

if (cluster.isMaster) {
  const numWorkers = os.cpus().length
  console.log(`主进程 ${process.pid}，启动 ${numWorkers} 个 worker`)

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} 退出，重启中`)
    cluster.fork()
  })
} else {
  http.createServer((req, res) => {
    res.end(`Worker ${process.pid}`)
  }).listen(3000)
}
```

经过线上验证，这套方案运行稳定。

## 实战案例

先来看基本的用法：

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
    new MiniCssExtractPlugin({ filename: '[name].css' })
  ]
}
```

这种写法简洁明了，适合大多数场景。

## 小结

- 持续学习和总结，保持技术敏感度
- 遇到问题多看源码和官方文档
- Vue 2 Mixin 使用与陷阱的关键在于理解核心概念，不要停留在表面用法
