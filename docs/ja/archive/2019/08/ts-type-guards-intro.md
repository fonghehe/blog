---
title: "TypeScript型ガード入門"
date: 2019-08-02 11:07:11
tags:
  - TypeScript
readingTime: 2
description: "最近のプロジェクトで TypeScript の型ガードを使用してみて、思ったより複雑だと感じました。実践で得た経験を共有します。"
wordCount: 404
---

最近のプロジェクトで TypeScript の型ガードを使用してみて、予想よりも複雑だと感じました。実践で得た経験を共有します。

## コア原理

具体的な実装は以下のコードを参照してください：

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

本番環境での検証を経て、この方式は安定して動作しています。

## ソースコード解析

基本的な使い方を見てみましょう：

```javascript
const express = require('express')
const app = express()

// ミドルウェア
app.use(express.json())

function errorHandler(err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'サーバーエラー' : err.message
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

この書き方は簡潔で明確であり、ほとんどのシーンに適しています。

## 実践応用

コアコードは以下の通りです：

```javascript
const http = require('http')
const cluster = require('cluster')
const os = require('os')

if (cluster.isMaster) {
  const numWorkers = os.cpus().length
  console.log(`メインプロセス ${process.pid}、${numWorkers} 個のワーカーを起動`)

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} が終了、再起動中`)
    cluster.fork()
  })
} else {
  http.createServer((req, res) => {
    res.end(`Worker ${process.pid}`)
  }).listen(3000)
}
```

実際のプロジェクトでは、境界条件と例外処理も考慮する必要があります。

## ベストプラクティス

以下は実際の例です：

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

このパターンをチームで展開したところ効果が良好で、保守コストが明らかに低下しました。

## まとめ

- 問題に直面したら、ソースコードと公式ドキュメントをよく確認する
- TypeScript 型ガードの鍵はコアコンセプトを理解することであり、表面的な使い方にとどまらないこと
- 実際のプロジェクトではシーンに応じて適切な方式を選択する
- チーム内で統一された约定は、完璧な実装を追求するよりも重要
