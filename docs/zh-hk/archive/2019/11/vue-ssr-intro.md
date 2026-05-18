---
title: "Vue 2 SSR 服務端渲染入門"
date: 2019-11-08 10:44:30
tags:
  - Vue
readingTime: 1
description: "最近項目中用到了Vue 2 SSR 服務端渲染入門，發現比預想的要複雜。分享一下實踐過程中總結的經驗。"
---

最近項目中用到了Vue 2 SSR 服務端渲染入門，發現比預想的要複雜。分享一下實踐過程中總結的經驗。

## 基本概念

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

## 深入理解

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

## 項目應用

核心代碼如下：

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum 計算正確', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce 延遲執行', () => {
    jest.useFakeTimers()
    const fn = jest.fn()
    const debounced = debounce(fn, 300)

    debounced()
    debounced()
    debounced()
    expect(fn).not.toHaveBeenCalled()

    jest.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
```

實際項目中還需要考慮邊界條件和異常處理。

## 小結

- 遇到問題多看源碼和官方文檔
- Vue 2 SSR 服務端渲染入門的關鍵在於理解核心概念，不要停留在表面用法
- 實際項目中根據場景選擇合適的方案
- 團隊中統一約定比追求完美實現更重要
