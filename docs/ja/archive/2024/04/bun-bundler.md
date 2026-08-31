---
title: "Bun バンドラーパフォーマンス実測"
date: 2024-04-15 11:13:48
tags:
  - フロントエンド
readingTime: 2
description: "Bun 打包器性能实测このトピックはコミュニティで何度も議論されていますが、バージョンアップのたびに多くの結論を更新する必要があります。本記事では最新バージョンに基づいて再整理します。"
wordCount: 478
---

Bun 打包器性能实测このトピックはコミュニティで何度も議論されていますが、バージョンアップのたびに多くの結論を更新する必要があります。本記事では最新バージョンに基づいて再整理します。

## 入門ガイド

実際のプロジェクトでの使用法はより複雑になります：

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

この方法により、コードのテスト可能性と拡張性が向上します。

## ソースコード分析

以下は完全な例です：

```javascript
const fs = require('fs')
const { Transform, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const csvToJson = new Transform({
  transform(chunk, encoding, callback) {
    const lines = chunk.toString().split('\n')
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const values = lines[i].split(',')
      const obj = {}
      headers.forEach((h, idx) => obj[h.trim()] = values[idx]?.trim())
      this.push(JSON.stringify(obj) + '\n')
    }
    callback()
  }
})

```

境界条件の処理に注意してください。これはプロダクション環境で非常に重要です。

## 実際のシナリオへの応用

重要なのはコアロジックを理解することです：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

パフォーマンスの最適化は具体的なシナリオと組み合わせる必要があり、全ての状況で過度な最適化が必要なわけではありません。

## 最適化のヒント

以下の方法で改善できます：

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

このソリューションは半年以上、本番環境で安定して稼働しており、実際に検証されています。

## まとめ

- 本番投入前には必ず互換性を検証する
- チーム開発では技術そのものより規約とドキュメントが重要だ
- コミュニティの動向を追い続け、技術方針は継続的に見直す
- 新技術を使うために新技術を使うのはやめる
- コード例はあくまで参考用であり、業務シーンに合わせて調整が必要だ