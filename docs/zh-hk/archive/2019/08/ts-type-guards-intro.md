---
title: "TypeScript 類型守衞入門"
date: 2019-08-02 11:07:11
tags:
  - TypeScript
readingTime: 2
description: "最近項目中用到了TypeScript 類型守衞入門，發現比預想的要複雜。分享一下實踐過程中總結的經驗。"
---

最近項目中用到了TypeScript 類型守衞入門，發現比預想的要複雜。分享一下實踐過程中總結的經驗。

## 核心原理

具體實現參考以下代碼：

```javascript
:root {
  --primary: #3498db;
  --bg: #fff;
  --text: #333;
}

[data-theme='dark'] {
  --primary: #5dade2;
  --bg: #1a1a2e;
  --text: #eee;
}

body {
  background: var(--bg);
  color: var(--text);
  transition: background 0.3s, color 0.3s;
}
```

經過線上驗證，這套方案運行穩定。

## 源碼分析

先來看基本的用法：

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

這種寫法簡潔明瞭，適合大多數場景。

## 實際應用

核心代碼如下：

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

實際項目中還需要考慮邊界條件和異常處理。

## 最佳實踐

下面是一個實際的例子：

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

這種模式在團隊中推廣後效果很好，維護成本明顯降低。

## 小結

- 遇到問題多看源碼和官方文檔
- TypeScript 類型守衞入門的關鍵在於理解核心概念，不要停留在表面用法
- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
