---
title: "Vite + Vue 3：超高速開発体験"
date: 2021-01-08 17:36:35
tags:
  - Vue
  - Vite
  - JavaScript
  - CSS
  - Node.js

readingTime: 2
description: "Vite + Vue 3 开发环境极速体验このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。"
---

Vite + Vue 3 开发环境极速体验このテーマはコミュニティで何度も議論されていますが、バージョンアップに伴い多くの結論は更新が必要です。本記事では最新バージョンをベースに改めて整理します。

## 入門ガイド

まず基本的な実装方法を見てみましょう：

```javascript
import { ref, computed, watch, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const doubled = computed(() => count.value * 2)

    watch(count, (newVal, oldVal) => {
      console.log(`count: ${oldVal} -> ${newVal}`)
    })

    onMounted(() => { console.log('组件已挂载') })

    return { count, doubled }
  }
}

```

このコードは基本的な使い方を示しています。実際のプロジェクトではエラー処理と境界条件も考慮する必要があります。

## ソースコード分析

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

## 実際のシナリオへの応用

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

## 最適化テクニック

完全な例を以下に示します：

```javascript
import { reactive, toRefs, computed } from 'vue'

function useCounter(initial = 0) {
  const state = reactive({ count: initial, history: [initial] })
  const doubled = computed(() => state.count * 2)

  function increment() {
    state.count++
    state.history.push(state.count)
  }

  return { ...toRefs(state), doubled, increment }
}

```

境界条件の処理に注意してください。これは本番環境で非常に重要です。

## まとめ

- Vite + Vue 3 开发环境极速体验不是银弹，需要根据项目规模和技术栈选择
- 基礎的な原理を理解することは、APIを暗記することより重要です
- 本番環境で使用する前に必ず互換性を確認してください
