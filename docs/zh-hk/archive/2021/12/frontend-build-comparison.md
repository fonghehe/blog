---
title: "前端構建工具對比：Webpack vs Vite vs esbuild"
date: 2021-12-27 14:31:37
tags:
  - 前端
  - 工程化
readingTime: 2
description: "2021 年是前端構建工具大變革的一年。Vite 2.0 成熟、esbuild 被廣泛採用、Webpack 5 逐步普及。作為一個維護多個項目的技術負責人，今年的構建工具選型讓我重新思考了\"什麼是最合適的工具\"。"
wordCount: 341
---

2021 年是前端構建工具大變革的一年。Vite 2.0 成熟、esbuild 被廣泛採用、Webpack 5 逐步普及。作為一個維護多個項目的技術負責人，今年的構建工具選型讓我重新思考了"什麼是最合適的工具"。

## 現狀分析

```
我們的項目分佈：
- 3 個 Vue 3 新項目 → Vite
- 2 個 Vue 2 遺留項目 → Webpack 4/5
- 1 個 React 項目 → Webpack 5 + esbuild loader
- 1 個組件庫 → Rollup（通過 Vite Library Mode）
- 2 個 Node.js 服務 → esbuild 直接打包
```

## 開發體驗對比

基於實際項目數據：

```
指標                    Webpack 4    Webpack 5    Vite 2
------------------------------------------------------------
冷啓動時間              35s          20s          0.8s
HMR 響應                2-5s         1-3s         <50ms
配置文件行數            200+         180+         30-50
插件生態                最豐富        最豐富       兼容 Rollup
TypeScript 支援         需要 loader   需要 loader  原生（esbuild）
CSS Modules             需要設定     需要設定     開箱即用
Tree Shaking            支持         更好         基於 Rollup
```

## Vite 適合的場景

```javascript
// vite.config.ts - 配置極其簡潔
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
    minify: 'esbuild', // 比 Terser 快 10 倍
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

Vite 最適合：
- 新項目，特別是 Vue 3 項目
- 對開發體驗有高要求的團隊
- 中小型項目（大型項目需要手動優化分包）

## Webpack 不可替代的場景

```javascript
// webpack.config.js - 雖然配置複雜，但能力強大
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
          loader: 'esbuild-loader', // 用 esbuild 替代 ts-loader
          options: { loader: 'tsx' }
        }
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack'] // SVG 作為 React 組件導入
      }
    ]
  },
  // Webpack 5 的 Module Federation
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

Webpack 仍然不可替代的場景：
- Module Federation 微前端
- 需要大量自定義 loader/plugin 的複雜項目
- 已有大量 Webpack 配置投資的遺留項目

## esbuild 的定位

esbuild 不適合直接做應用打包（缺少 code splitting、CSS 處理等），但作為底層工具非常出色：

```javascript
// esbuild 適合的場景

// 1. Node.js 服務打包
require('esbuild').buildSync({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outfile: 'dist/server.js',
  minify: true
})

// 2. 作為其他工具的加速層
// Vite 用 esbuild 做依賴預構建和 TS 轉譯
// Webpack 用 esbuild-loader 替代 ts-loader + Terser
// Rollup 用 rollup-plugin-esbuild 替代 @rollup/plugin-typescript
```

## 選型建議

```
場景                          推薦方案
------------------------------------------------------
Vue 3 新項目                  Vite（首選）
React 新項目                  Vite 或 Next.js
遺留項目                      保持 Webpack，優化配置
組件庫打包                    Rollup 或 Vite Library Mode
Node.js 服務                  esbuild
微前端（模塊聯邦）            Webpack 5
文檔站                        VitePress / Docusaurus
```

## 小結

- Vite 在開發體驗上已經全面超越 Webpack，新項目推薦首選
- Webpack 在複雜場景和 Module Federation 上仍然不可替代
- esbuild 不是應用級打包器的替代品，而是優秀的底層工具
- 構建工具選型要結合團隊能力、項目特點和生態兼容性
- 2021 年的趨勢是 Rust 化和 esbuild 化——更快的底層，更好的 DX