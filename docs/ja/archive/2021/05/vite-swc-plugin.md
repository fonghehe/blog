---
title: "Vite + SWC：コンパイル高速化"
date: 2021-05-06 10:05:35
tags:
  - Vite
  - エンジニアリング

readingTime: 2
description: "Vite + SWC 编译加速このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。"
wordCount: 459
---

Vite + SWC によるコンパイル高速化は、コミュニティで何度も議論されてきたテーマだが、バージョンアップに伴い多くの結論が見直しを必要としている。本記事では最新バージョンをベースに改めて整理する。

## 入門ガイド

基本的な実装方法を見てみよう：

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

このコードは基本的な使い方を示している。実際のプロジェクトでは、エラー処理や境界条件も考慮する必要がある。

## ソースコード分析

この基盤の上でさらに最適化できる：

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

このパターンは大規模プロジェクトで非常に実用的で、保守コストを大幅に削減できる。

## 実際のケースへの応用

実際のプロジェクトでは、より複雑な使い方になる：

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

このアプローチにより、コードのテスト容易性とスケーラビリティが向上する。

## 最適化テクニック

全体のサンプルを以下に示す：

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

境界条件の処理には注意が必要だ。本番環境では特に重要になる。

## まとめ

- コードサンプルは参考用であり、実際のユースケースに合わせて調整が必要だ
- Vite + SWC によるコンパイル高速化は万能薬ではなく、プロジェクトの規模や技術スタックに応じて選ぶ必要がある
- 基礎的な原理を理解することは、API を暗記することより重要だ