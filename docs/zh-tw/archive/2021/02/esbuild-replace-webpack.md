---
title: "esbuild：用 Go 重寫的 JS 打包器"
date: 2021-02-08 09:51:13
tags:
  - React
  - Angular
  - Webpack
  - Vite
  - Node.js
  - TypeScript
  - JavaScript
  - CSS
readingTime: 3
description: "esbuild 是 Evan Wallace 在 2020 年釋出的 JavaScript/TypeScript 打包器，用 Go 語言編寫。它不是最快的 JS 打包器，它是快到不真實的那種——比 Webpack 快 100 倍，比 Parcel 快 100 倍，比 Rollup 快數倍。Vite 用它做依賴預構建，S"
wordCount: 601
---

esbuild 是 Evan Wallace 在 2020 年釋出的 JavaScript/TypeScript 打包器，用 Go 語言編寫。它不是最快的 JS 打包器，它是快到不真實的那種——比 Webpack 快 100 倍，比 Parcel 快 100 倍，比 Rollup 快數倍。Vite 用它做依賴預構建，Snowpack 也集成了它。

## 為什麼這麼快

esbuild 速度快有三個原因：

1. **Go 語言**：編譯型語言，天然比 JS 快。Go 的併發模型（goroutine）也讓並行處理更高效
2. **從零實現**：不用任何現有的 JS 庫（如 acorn、babel），全部自己實現 parser 和 bundler
3. **記憶體最佳化**：資料結構儘量緊湊，減少記憶體分配和 GC 壓力

```bash
# 實際測試：打包 10 個 Three.js 複製
# esbuild:  ~47ms
# Webpack:  ~4,250ms
# Rollup:   ~1,780ms
# Parcel:   ~4,500ms
```

## 基本使用

```bash
# 全域性安裝
npm install -g esbuild

# 打包單檔案
esbuild app.ts --bundle --outfile=out.js

# 打包為生產環境
esbuild app.ts --bundle --minify --outfile=out.js

# 多入口
esbuild src/home.ts src/about.ts --bundle --outdir=dist
```

## API 使用

esbuild 有 CLI 和 API 兩種使用方式，API 更靈活：

```javascript
const esbuild = require('esbuild')

// 構建
async function build() {
  const result = await esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
    outdir: 'dist',
    format: 'esm',
    splitting: true, // 程式碼分割（ESM 格式下可用）
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    loader: {
      '.tsx': 'tsx',
      '.css': 'css',
      '.png': 'dataurl',
      '.svg': 'text'
    },
    external: ['react', 'react-dom'], // 不打包這些
    plugins: [
      // 外掛示例
      {
        name: 'env-plugin',
        setup(build) {
          build.onResolve({ filter: /^env$/ }, () => ({
            path: 'env',
            namespace: 'env-ns'
          }))
          build.onLoad({ filter: /.*/, namespace: 'env-ns' }, () => ({
            contents: JSON.stringify(process.env),
            loader: 'json'
          }))
        }
      }
    ]
  })

  console.log(`構建完成，輸出 ${result.outputFiles.length} 個檔案`)
}

build()
```

## Watch 模式

```javascript
const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist',
  sourcemap: true
})

// 監聽檔案變化
await ctx.watch()

// 啟動開發伺服器（esbuild 0.17+）
await ctx.serve({
  port: 3000,
  servedir: 'dist'
})
```

## esbuild 在 Vite 中的角色

Vite 在兩個關鍵位置使用了 esbuild：

1. **依賴預構建**：開發階段，將 CommonJS 依賴轉為 ESM，將許多內部模組合併為一個檔案
2. **生產構建的程式碼壓縮**：Vite 2.7+ 支援用 esbuild 做 minify，比 Terser 快很多

```javascript
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    // esbuild 預構建配置
    esbuildOptions: {
      target: 'es2020',
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    // Vite 2.7+ 使用 esbuild 壓縮
    minify: 'esbuild', // 'terser' | 'esbuild'
    target: 'es2015'
  }
})
```

## 目前的侷限

esbuild 不是萬能的，有幾個明顯限制：

1. **沒有程式碼分割的 IIFE 格式**：ESM 格式支援 `splitting`，但傳統格式不支援
2. **不支援轉換裝飾器語法**：Angular 專案無法直接用
3. **不支援 HMR**：自己不會實現 HMR，需要上層框架處理
4. **外掛生態很小**：Webpack 外掛不能直接遷移
5. **CSS 處理有限**：不支援 CSS Modules、PostCSS 等高階功能

```javascript
// ❌ 不支援裝飾器
@Component({ template: '<div/>' })
class MyComponent { }

// ❌ 不支援 CSS Modules（需要自行處理）
import styles from './app.module.css'
```

## 和 Webpack 的定位差異

esbuild 不是 Webpack 的替代品，至少目前不是。它的定位更像是：

- **構建加速器**：在現有工具鏈中替代最慢的環節（編譯 TS、打包、壓縮）
- **原型工具**：小型專案和庫的打包，配置簡單
- **底層基礎設施**：Vite、Snowpack 等工具的底層引擎

```javascript
// Webpack 使用者的漸進式採用方式
// 1. 用 esbuild-loader 替代 babel-loader + ts-loader
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'esbuild-loader',
        options: {
          loader: 'tsx',    // tsx 檔案用 tsx loader
          target: 'es2015'
        }
      }
    ]
  },
  plugins: [
    // 2. 用 EsbuildPlugin 替代 TerserPlugin 做壓縮
    new EsbuildPlugin({
      target: 'es2015',
      css: true
    })
  ]
}
```

## 小結

- esbuild 用 Go 編寫，速度比傳統工具快 100 倍，不是營銷話術是實測資料
- 適合用作底層加速工具（Vite、Snowpack 已整合），不適合完全替代 Webpack
- Webpack 使用者可以用 esbuild-loader 做漸進式提速
- 外掛生態、CSS 處理、HMR 還不成熟，關注但不要盲目全面切換
- 它代表了一個趨勢：前端工具鏈正在從 JS 遷移到編譯型語言
