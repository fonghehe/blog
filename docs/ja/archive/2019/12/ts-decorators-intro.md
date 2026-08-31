---
title: "TypeScriptデコレーター入門"
date: 2019-12-13 10:00:24
tags:
  - TypeScript
readingTime: 2
description: "在团队推广TypeScript 装饰器入门的过程中，踩了不少坑。整理出来希望对大家有所帮助。"
wordCount: 376
---

在团队推广TypeScript 装饰器入门的过程中，踩了不少坑。整理出来希望对大家有所帮助。

## クイックスタート

コアとなるコードは以下のとおり：

```javascript
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  grid-gap: 1.5rem;
}

.grid__item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s, box-shadow 0.2s;
}

.grid__item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
```

実際のプロジェクトでは、境界条件や例外処理も考慮する必要がある。

## 高度な使い方

以下は実際の例である：

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

このパターンをチームに導入したところ効果が良く、保守コストが明らかに低下した。

## ビジネスシナリオ

以下の方法で実現できる：

```javascript
const express = require('express')
const app = express()

// 中间件
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

上記コードのパフォーマンス上の細部に注意し、不要な計算を避けること。

## 落とし穴回避ガイド

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

## クイックスタート

まずは基本的な使い方から：

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

この書き方は簡潔明快で、ほとんどのシーンに向いている。

## まとめ

- 実際のプロジェクトでは、場面に応じて適切なアプローチを選ぶこと
- チーム内で統一した取り決めを作ることは、完璧な実装を追及するよりも重要だ
- 継続的に学び、振り返りを行い、技術に対する感度を保つこと
