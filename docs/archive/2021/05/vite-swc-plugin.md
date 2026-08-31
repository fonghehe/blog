---
title: "Vite + SWC 编译加速"
date: 2021-05-06 10:05:35
tags:
  - Vite
readingTime: 2
description: "Vite + SWC 编译加速这个话题社区讨论了很多次，但随着版本迭代，很多结论需要更新。本文基于最新版本重新梳理。"
wordCount: 253
---

Vite + SWC 编译加速，社区讨论过很多次，但随着版本迭代，不少结论需要更新。本文基于最新版本重新梳理。

## 入门指南

先看基础用法：

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

以上只是最小示例，实际项目里还要处理错误与边界条件。

## 源码分析

在此基础上还可以继续优化：

```javascript
module.exports = {
  entry: './src/index.js',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash:8].js' },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' }
      }
    }
  }
}

```

在大型项目里这套模式很实用，能明显降低维护成本。

## 真实场景应用

实际项目中的用法更复杂：

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

借助这种方式，代码的可测试性和可扩展性都更好。

## 优化技巧

下面给出一个完整示例：

```javascript
module.exports = {
  entry: './src/index.js',
  output: { path: __dirname + '/dist', filename: '[name].[contenthash:8].js' },
  module: {
    rules: [
      { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors' }
      }
    }
  }
}

```

注意处理边界条件，在生产环境里这点尤为关键。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- Vite + SWC 编译加速不是银弹，需结合项目规模和技术栈选择
- 理解底层原理比记住 API 更重要