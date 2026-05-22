---
title: "Vue 2 SSR：サーバーサイドレンダリング入門"
date: 2019-11-08 10:44:30
tags:
  - Vue
readingTime: 2
description: "最近のプロジェクトで Vue 2 SSR（サーバーサイドレンダリング）を使ってみて、思ったより複雑だと感じました。実践で得た経験を共有します。"
wordCount: 390
---

先日、プロジェクトでVue 2 SSRのサーバーサイドレンダリングを使用したところ、予想以上に複雑でした。実践で得た経験を共有します。

## 基本概念

具体的な実装は以下のコードを参考にしてください：

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

本番環境で検証した結果、この方法は安定して動作しています。

## 深掘り

まず基本的な使い方を見てみましょう：

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

この書き方はシンプルで明確であり、ほとんどのシナリオに適しています。

## プロジェクト応用

核心となるコードは以下のとおりです：

```javascript
const { sum, debounce } = require('./utils')

describe('utils', () => {
  test('sum 计算正确', () => {
    expect(sum(1, 2)).toBe(3)
    expect(sum(-1, 1)).toBe(0)
  })

  test('debounce 延迟执行', () => {
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

実際のプロジェクトでは、境界条件と例外処理も考慮する必要があります。

## まとめ

- 問題に直面したら、ソースコードと公式ドキュメントをよく確認しましょう
- Vue 2 SSRのサーバーサイドレンダリングで重要なのは、コアコンセプトを理解することで、表面的な使い方にとどまらないことです
- 実際のプロジェクトでは、シナリオに応じて適切な方法を選択しましょう
- チーム内で統一されたルールを決めることは、完璧な実装を追求するよりも重要です
