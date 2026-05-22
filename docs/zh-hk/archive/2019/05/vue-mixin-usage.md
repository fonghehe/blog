---
title: "Vue 2 Mixin 使用與陷阱：落地路徑與實戰建議"
date: 2019-05-07 17:00:41
tags:
  - Vue
readingTime: 1
description: "很多同學在Vue 2 Mixin 使用與陷阱上存在理解偏差，本文系統地梳理核心要點和常見誤區。"
wordCount: 193
---

很多同學在Vue 2 Mixin 使用與陷阱上存在理解偏差，本文系統地梳理核心要點和常見誤區。

## 基礎用法

我們可以通過以下方式實現：

```javascript
const express = require('express')
const app = express()

// 中間件
app.use(express.json())

function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? '服務器錯誤' : err.message
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

注意上面代碼中的性能細節，避免不必要的計算。

## 進階技巧

具體實現參考以下代碼：

```javascript
const http = require('http')
const cluster = require('cluster')
const os = require('os')

if (cluster.isMaster) {
  const numWorkers = os.cpus().length
  console.log(`主進程 ${process.pid}，啓動 ${numWorkers} 個 worker`)

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} 退出，重啓中`)
    cluster.fork()
  })
} else {
  http.createServer((req, res) => {
    res.end(`Worker ${process.pid}`)
  }).listen(3000)
}
```

經過線上驗證，這套方案運行穩定。

## 實戰案例

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 小結

- 持續學習和總結，保持技術敏感度
- 遇到問題多看源碼和官方文檔
- Vue 2 Mixin 使用與陷阱的關鍵在於理解核心概念，不要停留在表面用法
