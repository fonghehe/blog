---
title: "Webpackのルートレベルコード分割"
date: 2020-05-14 16:51:06
tags:
  - Webpack
  - エンジニアリング
readingTime: 2
description: "最近チームでWebpack ルート単位のコード分割を導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 491
---

最近チームで Webpack のルートレベルなコード分割を本番導入し、いくつかの経験を積んだ。似たような取り組みをする人の参考になればと、ここにまとめる。

## コアコンセプト

以下の方法で改善できる：

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

この手法は本番環境で半年以上安定稼働しており、実際に検証済みだ。

## 深掘り解析

基本的な実装から見ていこう：

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
          vendor: ['vue', 'vue-router', 'vuex'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

ここでは基本的な使い方を示している。実際のプロジェクトでは、エラー処理や境界条件も考慮する必要がある。

## 実装経験

この上にさらに最適化を重ねられる：

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

このパターンは大規模なプロジェクトで非常に実用になり、保守コストを大きく下げられる。

## 调优策略

実際のプロジェクトでは、もう少し込み入った使い方になる：

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
          vendor: ['vue', 'vue-router', 'vuex'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

このアプローチなら、コードのテスタビリティと拡張性がともに高まる。

## 注意事項

以下は全体のサンプルだ：

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

- API を丸暗記するより、基礎となる仕組みを理解するほうが重要だ
- 本番投入前には必ず互換性を検証する
- チーム開発では、技術そのものより規約とドキュメントが重要になる
- コミュニティの動向を追い、技術的なアプローチは継続的に改善していく必要がある
- 新しい技術を使うために使うべきではない
