---
title: "フロントエンドビルドツール比較：Webpack vs Vite vs esbuild"
date: 2021-12-27 14:31:37
tags:
  - エンジニアリング
  - Webpack
  - Vite

readingTime: 3
description: "2021年はフロントエンドビルドツールの大きな変革の年でした。Vite 2.0 が成熟し、esbuild が広く採用され、Webpack 5 が徐々に普及しました。複数のプロジェクトを担当するテクニカルリーダーとして、今年のビルドツール選定は「最適なツールとは何か」を再考させるものでした。"
wordCount: 587
---

2021年はフロントエンドビルドツールの大きな変革の年でした。Vite 2.0 が成熟し、esbuild が広く採用され、Webpack 5 が徐々に普及しました。複数のプロジェクトを担当するテクニカルリーダーとして、今年のビルドツール選定は「最適なツールとは何か」を再考させました。

## 現状分析

```
私たちのプロジェクト分布：
- 3 つの Vue 3 新規プロジェクト → Vite
- 2 つの Vue 2 レガシープロジェクト → Webpack 4/5
- 1 つの React プロジェクト → Webpack 5 + esbuild loader
- 1 つのコンポーネントライブラリ → Rollup（Vite Library Mode 経由）
- 2 つの Node.js サービス → esbuild で直接バンドル
```

## 開発者体験の比較

実際のプロジェクトデータに基づく：

```
指標                    Webpack 4    Webpack 5    Vite 2
------------------------------------------------------------
コールドスタート時間    35s          20s          0.8s
HMR 応答性              2-5s         1-3s         <50ms
設定ファイル行数        200+         180+         30-50
プラグインエコシステム  最も豊富    最も豊富     Rollup 互換
TypeScript サポート     loader 必要  loader 必要  ネイティブ（esbuild）
CSS Modules             設定必要    設定必要     初期対応
Tree Shaking            対応        より良好     Rollup ベース
```

## Vite が得意とするシナリオ

```javascript
// vite.config.ts - 設定が非常にシンプル
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import WindiCSS from 'vite-plugin-windicss'

export default defineConfig({
  plugins: [vue(), WindiCSS()],
  resolve: {
    alias: { '@': '/src' }
  },
  build: {
    target: 'es2015',
    minify: 'esbuild', // Terser より10倍高速
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia']
        }
      }
    }
  }
})
```

Vite が最も適しているのは：
- 新規プロジェクト、特に Vue 3 プロジェクト
- 開発体験に高い要求を持つチーム
- 中規模プロジェクト（大規模プロジェクトは手動でのチャンク最適化が必要）

## Webpack が不可欠なシナリオ

```javascript
// webpack.config.js - 設定は複雑ですが、能力は強力です
module.exports = {
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.tsx?$/,
        use: {
          loader: 'esbuild-loader', // esbuild で ts-loader を代替
          options: { loader: 'tsx' }
        }
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'] // SVG を React コンポーネントとしてインポート
      }
    ]
  },
  // Webpack 5 の Module Federation
  plugins: [
    new ModuleFederationPlugin({
      name: 'app1',
      remotes: {
        app2: 'app2@http://localhost:3002/remoteEntry.js'
      },
      shared: ['vue', 'vue-router']
    })
  ]
}
```

Webpack が依然として代替不可能なシナリオ：
- Module Federation マイクロフロントエンド
- 大量のカスタム loader/plugin が必要な複雑なプロジェクト
- 既に多くの Webpack 設定投資があるレガシープロジェクト

## esbuild のポジショニング

esbuild はアプリケーションのバンドルに直接使用するのには適していません（コード分割や CSS 処理などが不足しています）が、基盤ツールとして非常に優れています：

```javascript
// esbuild が適しているシナリオ

// 1. Node.js サービスのバンドル
require('esbuild').buildSync({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outfile: 'dist/server.js',
  minify: true
})

// 2. 他のツールの高速化レイヤーとして
// Vite は esbuild を使用して依存関係の事前バンドルと TS トランスパイルを実行
// Webpack は esbuild-loader で ts-loader + Terser を代替
// Rollup は rollup-plugin-esbuild で @rollup/plugin-typescript を代替
```

## 選定の推奨事項

```
シナリオ                          推奨ソリューション
------------------------------------------------------
Vue 3 新規プロジェクト            Vite（最優先）
React 新規プロジェクト            Vite または Next.js
レガシープロジェクト              Webpack を維持、設定を最適化
コンポーネントライブラリのバンドル  Rollup または Vite Library Mode
Node.js サービス                  esbuild
マイクロフロントエンド（Module Federation）  Webpack 5
ドキュメントサイト                VitePress / Docusaurus
```

## まとめ

- Vite は開発体験において Webpack を全面的に凌駕しており、新規プロジェクトでは最優先で推奨されます
- Webpack は複雑なシナリオや Module Federation において依然として代替不可能です
- esbuild はアプリケーションレベルのバンドラーの代替品ではなく、優れた基盤ツールです
- ビルドツールの選定はチームの能力、プロジェクトの特性、エコシステムの互換性を考慮する必要があります
- 2021年のトレンドは Rust 化と esbuild 化——より高速な基盤、より優れた DX
