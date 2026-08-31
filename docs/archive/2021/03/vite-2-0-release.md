---
title: "Vite 2.0 发布 构建工具新纪元"
date: 2021-03-05 10:05:54
tags:
  - Vite
readingTime: 2
description: "在日常开发中，Vite 2.0 发布 构建工具新纪元的使用频率越来越高。本文系统地讲解其用法、原理和优化策略。"
wordCount: 263
---

Vite 2.0 发布了，号称构建工具的新纪元，实际用的人也越来越多。本文系统讲讲它的用法、原理和可以做的优化。

## 快速上手

先看最基础的配置：

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

这段代码展示了基本用法，实际项目里还得把错误处理和边界情况考虑进去。

## 内部原理

在这个基础上继续优化：

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

这种写法在大型项目里很实用，能明显压低维护成本。

## 业务实战

真实项目里的用法会更复杂一些：

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

这样抽一层之后，代码更好测，也更好扩展。

## 性能对比

看一个相对完整的例子：

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

边界情况要处理好，生产环境里这点很关键。

## 小结

- 代码示例仅供参考，需根据业务场景调整
- Vite 2.0 发布 构建工具新纪元不是银弹，需要根据项目规模和技术栈选择
- 理解底层原理比记住 API 更重要