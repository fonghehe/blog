---
title: "前端構建效能最佳化：從 Webpack 到 Vite"
date: 2021-09-20 11:47:17
tags:
  - 效能最佳化
  - 工程化
readingTime: 3
description: "最近幾個專案陸續從 Webpack 遷移到了 Vite，構建速度的差距比想象中大。這篇整理一下構建效能最佳化的思路，從 Webpack 調優到直接換 Vite 的決策過程。"
wordCount: 515
---

最近幾個專案陸續從 Webpack 遷移到了 Vite，構建速度的差距比想象中大。這篇整理一下構建效能最佳化的思路，從 Webpack 調優到直接換 Vite 的決策過程。

## Webpack 的瓶頸在哪

Webpack 之所以慢，核心原因：**一切皆模組，模組必須先打包再啟動**。

```
啟動 dev server：
1. 分析入口檔案
2. 遞迴解析所有 import → 構建完整依賴圖
3. 編譯所有模組（Babel + Loader 鏈）
4. 生成 bundle
5. 啟動伺服器

專案大了之後，步驟 2-4 可能要 30s-2min
```

## Webpack 調優（還能榨出多少效能）

### 1. 縮小搜尋範圍

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        include: path.resolve(__dirname, 'src'), // 只處理 src
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // 少寫字尾，但別列太多
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // 不需要解析 symlink
    symlinks: false,
  },
}
```

### 2. 快取

```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              // 開啟持久快取（Webpack 5 內建）
              // ts-loader + transpileOnly 大幅提速
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  // Webpack 5 持久快取
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
}
```

### 3. 多執行緒

```javascript
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 多執行緒壓縮
      }),
    ],
  },
  // 或者用 thread-loader
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          'thread-loader', // 把後續 loader 放到 worker 池
          'ts-loader',
        ],
      },
    ],
  },
}
```

### 4. DLL（老方案，Webpack 5 不需要了）

```javascript
// Webpack 4 時代的方案：預打包不變的依賴
// Webpack 5 用 cache.type: 'filesystem' 替代
```

### Webpack 調優的天花板

實測一箇中型專案（200+ 模組）：

| 最佳化項 | 時間 |
|--------|------|
| 無最佳化 | 45s |
| ts-loader transpileOnly | 28s |
| filesystem cache（二次啟動） | 8s |
| thread-loader | 22s |
| 全部最佳化 | 6s（二次啟動） |

二次啟動 6s 已經是 Webpack 的極限了，首次啟動還是要 20s+。

## Vite：換個思路

Vite 的核心想法：**開發環境不打包，生產環境用 Rollup**。

```
啟動 dev server：
1. 啟動伺服器（幾乎瞬時）
3. 瀏覽器請求 → 按需編譯單個檔案
4. 返回結果

啟動時間：< 1s
```

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install
npm run dev   # < 1s 啟動
```

## Vite 為什麼快

```typescript
// 瀏覽器請求 /src/main.ts
// Vite 返回：

// import { createApp } from 'vue'
// ↓ 轉換為
import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'

// 每個依賴都預構建好了（esbuild），每個檔案單獨編譯
// 只有你訪問到的模組才會被編譯
```

- 依賴預構建：esbuild（Go 語言寫的，比 JS 快 10-100 倍）
- 原始碼按需編譯：ESM + 瀏覽器原生匯入
- HMR：只編譯修改的檔案，和依賴圖大小無關

## 效能對比實測

同一個專案（Vue 3 + TypeScript，200+ 元件）：

| 指標 | Webpack 5（最佳化後） | Vite 2.x |
|------|---------------------|----------|
| 首次啟動 | 22s | 0.8s |
| 二次啟動（快取） | 6s | 0.3s |
| HMR | 2-5s | < 100ms |
| 生產構建 | 45s | 30s |
| 包體積（gzip） | 186KB | 178KB |

生產構建差距不大（Vite 用 Rollup，Rollup 的 tree-shaking 更好），開發體驗差距巨大。

## 遷移注意事項

```typescript
// 1. import 必須帶字尾（或者配置 resolve.extensions）
import { ref } from 'vue'         // ✅ 第三方包不需要字尾
import { useAuth } from './auth'  // ❌ Vite 預設需要字尾
import { useAuth } from './auth.ts' // ✅

// vite.config.ts 裡可以放寬
export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue'], // 新增字尾解析
  },
})

// 2. 環境變數
// Webpack: process.env.NODE_ENV
// Vite: import.meta.env.MODE

// 3. 靜態資源
// Webpack: require('./logo.png') → url
// Vite: import logo from './logo.png' → url

// 4. CSS Modules
// 兩種寫法都支援：
import styles from './index.module.css'  // ✅ Vite 推薦
```

## 哪些專案不適合遷移

- 高度依賴 Webpack 外掛生態的（Module Federation、特殊 loader）
- 遺留的 CommonJS 專案（Vite 開發環境用 ESM）
- 需要相容 IE11 的專案（Vite 不支援）

## 小結

- Webpack 調優能從 45s 降到 6s，但有天花板
- Vite 從根本上改變了開發體驗：按需編譯 + esbuild 預構建
- 新專案直接用 Vite，老專案評估 Webpack 外掛依賴後決定是否遷移
- 生產構建兩者差距不大，Vite 的 Rollup tree-shaking 略有優勢
- 2021 年，Vite 已經是 Vue 3 專案的事實標準