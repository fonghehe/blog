---
title: "Vue 2 SSR: Server-Side Rendering Introduction"
date: 2019-11-08 10:44:30
tags:
  - Vue
readingTime: 1
description: "I recently got started with Vue 2 SSR (server-side rendering) on a project and found it more involved than I expected. Here are some lessons from the experience."
wordCount: 141
---

I recently got started with Vue 2 SSR (server-side rendering) on a project and found it more involved than I expected. Here are some lessons from the experience.

## Basic Concepts

Here's a concrete implementation to refer to:

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

This approach has been validated in production and runs stably.

## Deep Dive

Let's start with the basic usage:

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

This style is clear and concise, and fits most scenarios.

## Project Application

The core code looks like this:

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

In a real project you'll also need to account for edge cases and error handling.

## Summary

- When you hit a problem, read the source code and the official docs
- The key to getting started with Vue 2 SSR is understanding the core concepts, not just the surface-level API
- In real projects, pick the right approach for your scenario
- Shared team conventions matter more than chasing a perfect implementation
