---
title: "Vite 2.0 リリース：ビルドツールの新時代"
date: 2021-03-05 10:05:54
tags:
  - Vite
  - エンジニアリング

readingTime: 2
description: "在日常开发中，Vite 2.0 发布 构建工具新纪元の使用頻度が高まっています。本記事では、その使い方、原理、最適化戦略を体系的に説明します。"
wordCount: 409
---

在日常开发中，Vite 2.0 发布 构建工具新纪元の使用頻度が高まっています。本記事では、その使い方、原理、最適化戦略を体系的に説明します。

## クイックスタート

まず基本的な実装方法を見てみましょう：

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

このコードは基本的な使い方を示しています。実際のプロジェクトではエラー処理と境界条件も考慮する必要があります。

## 内部原理

この基盤の上でさらに最適化できます：

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

このパターンは大規模プロジェクトで非常に実用的で、保守コストを大幅に削減できます。

## ビジネス実践

实际项目中的用法会更复杂一些：

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

このアプローチにより、コードのテスト可能性とスケーラビリティが向上します。

## パフォーマンス比較

完全な例を以下に示します：

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

境界条件の処理に注意してください。これは本番環境で非常に重要です。

## まとめ

- コードサンプルは参考用のみであり、ビジネスシナリオに応じて調整が必要です
- Vite 2.0 发布 构建工具新纪元不是银弹，需要根据项目规模和技术栈选择
- 基礎的な原理を理解することは、APIを暗記することより重要です