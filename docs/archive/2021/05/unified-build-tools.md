---
title: "前端构建工具统一化趋势"
date: 2021-05-12 10:39:03
tags:
  - 前端
  - 工程化
readingTime: 2
description: "最近在团队中落地前端构建工具统一化趋势，积累了不少经验。整理出来供参考，希望对做类似工作的同学有所帮助。"
wordCount: 255
---

最近团队在落地前端构建工具统一化，积累了一些经验。整理出来供参考，希望对做类似工作的同学有帮助。

## 核心概念

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

## 深度解析

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

## 落地经验

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

## 调优策略

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
- 前端构建工具统一化不是银弹，需结合项目规模和技术栈选择
- 理解底层原理比记住 API 更重要