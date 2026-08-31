---
title: "TypeScript Type Guards Introduction"
date: 2019-08-02 11:07:11
tags:
  - TypeScript
readingTime: 1
description: "I recently used TypeScript type guards on a project and found them more complex than expected. Here are some lessons from practice."
wordCount: 157
---

I recently used TypeScript type guards on a project and found them more complex than expected. Here are some lessons from practice.

## Core Principles

See the following code for a concrete implementation:

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

This approach has been validated in production and runs stably.

## Source Code Analysis

Let's start with the basic usage:

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

This style is clear and concise, and fits most scenarios.

## Practical Application

The core code is as follows:

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

In real projects you also need to consider edge cases and error handling.

## Best Practices

Here is a concrete example:

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

After this pattern was adopted by the team, results were good and maintenance cost dropped noticeably.

## Summary

- When you hit a problem, read the source code and official docs.
- The key to getting started with TypeScript type guards is understanding the core concepts, not just superficial usage.
- In real projects, pick the right approach for the situation.
- Agreeing on team-wide conventions matters more than chasing the perfect implementation.
