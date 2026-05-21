---
title: "SWC コンパイラ：プロジェクトでの実践的な使用方法"
date: 2022-04-18 11:47:50
tags:
  - フロントエンド
readingTime: 3
description: "SWC 编译器在项目中的应用このトピックはコミュニティで何度も議論されてきましたが、バージョンアップに伴い多くの結論を更新する必要があります。本記事では最新バージョンに基づいて再整理します。"
wordCount: 539
---

SWC 编译器在项目中的应用このトピックはコミュニティで何度も議論されてきましたが、バージョンアップに伴い多くの結論を更新する必要があります。本記事では最新バージョンに基づいて再整理します。

## 入門ガイド

以下は完全な例です：

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

境界条件の処理に注意してください。これは本番環境において非常に重要です。

## ソースコード分析

コアロジックを理解することが重要です：

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

パフォーマンス最適化は具体的なシナリオに合わせて行う必要があります。すべての場合に過剰な最適化が必要なわけではありません。

## 実際のシナリオへの応用

以下の方法で改善できます：

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

このアプローチは半年以上本番環境で安定して稼働しており、実際に検証されています。

## 最適化テクニック

まず基本的な実装方法から見てみましょう：

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

このコードは基本的な使用方法を示しています。実際のプロジェクトでは、エラー処理とエッジケースも考慮する必要があります。

## 落とし穴ガイド

この基盤の上で、さらに最適化できます：

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

このパターンは大規模プロジェクトで非常に実用的で、メンテナンスコストを大幅に削減できます。

## まとめ

- コミュニティの動向を注視し、技術ソリューションは継続的に反復する必要があります
- 新技術のために新技術を採用しないでください
- コード例は参考のみであり、ビジネスシナリオに応じて調整が必要です