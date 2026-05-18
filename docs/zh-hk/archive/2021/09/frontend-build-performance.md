---
title: "前端構建性能優化：從 Webpack 到 Vite"
date: 2021-09-20 11:47:17
tags:
  - 性能優化
  - 工程化
readingTime: 3
description: "最近幾個項目陸續從 Webpack 遷移到了 Vite，構建速度的差距比想象中大。這篇整理一下構建性能優化的思路，從 Webpack 調優到直接換 Vite 的決策過程。"
---

最近幾個項目陸續從 Webpack 遷移到了 Vite，構建速度的差距比想象中大。這篇整理一下構建性能優化的思路，從 Webpack 調優到直接換 Vite 的決策過程。

## Webpack 的瓶頸在哪

Webpack 之所以慢，核心原因：**一切皆模塊，模塊必須先打包再啓動**。

```
啓動 dev server：
1. 分析入口文件
2. 遞歸解析所有 import → 構建完整依賴圖
3. 編譯所有模塊（Babel + Loader 鏈）
4. 生成 bundle
5. 啓動服務器

項目大了之後，步驟 2-4 可能要 30s-2min
```

## Webpack 調優（還能榨出多少性能）

### 1. 縮小搜索範圍

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
    extensions: ['.ts', '.js'], // 少寫後綴，但別列太多
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // 不需要解析 symlink
    symlinks: false,
  },
}
```

### 2. 緩存

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
              // 開啓持久緩存（Webpack 5 內置）
              // ts-loader + transpileOnly 大幅提速
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
  // Webpack 5 持久緩存
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
}
```

### 3. 多線程

```javascript
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true, // 多線程壓縮
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

實測一箇中型項目（200+ 模塊）：

| 優化項 | 時間 |
|--------|------|
| 無優化 | 45s |
| ts-loader transpileOnly | 28s |
| filesystem cache（二次啓動） | 8s |
| thread-loader | 22s |
| 全部優化 | 6s（二次啓動） |

二次啓動 6s 已經是 Webpack 的極限了，首次啓動還是要 20s+。

## Vite：換個思路

Vite 的核心想法：**開發環境不打包，生產環境用 Rollup**。

```
啓動 dev server：
1. 啓動服務器（幾乎瞬時）
3. 瀏覽器請求 → 按需編譯單個文件
4. 返回結果

啓動時間：< 1s
```

```bash
npm create vite@latest my-app -- --template vue-ts
cd my-app
npm install
npm run dev   # < 1s 啓動
```

## Vite 為什麼快

```typescript
// 瀏覽器請求 /src/main.ts
// Vite 返回：

// import { createApp } from 'vue'
// ↓ 轉換為
import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'

// 每個依賴都預構建好了（esbuild），每個文件單獨編譯
// 只有你訪問到的模塊才會被編譯
```

- 依賴預構建：esbuild（Go 語言寫的，比 JS 快 10-100 倍）
- 源碼按需編譯：ESM + 瀏覽器原生導入
- HMR：只編譯修改的文件，和依賴圖大小無關

## 性能對比實測

同一個項目（Vue 3 + TypeScript，200+ 組件）：

| 指標 | Webpack 5（優化後） | Vite 2.x |
|------|---------------------|----------|
| 首次啓動 | 22s | 0.8s |
| 二次啓動（緩存） | 6s | 0.3s |
| HMR | 2-5s | < 100ms |
| 生產構建 | 45s | 30s |
| 包體積（gzip） | 186KB | 178KB |

生產構建差距不大（Vite 用 Rollup，Rollup 的 tree-shaking 更好），開發體驗差距巨大。

## 遷移注意事項

```typescript
// 1. import 必須帶後綴（或者配置 resolve.extensions）
import { ref } from 'vue'         // ✅ 第三方包不需要後綴
import { useAuth } from './auth'  // ❌ Vite 默認需要後綴
import { useAuth } from './auth.ts' // ✅

// vite.config.ts 裏可以放寬
export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js', '.vue'], // 添加後綴解析
  },
})

// 2. 環境變量
// Webpack: process.env.NODE_ENV
// Vite: import.meta.env.MODE

// 3. 靜態資源
// Webpack: require('./logo.png') → url
// Vite: import logo from './logo.png' → url

// 4. CSS Modules
// 兩種寫法都支持：
import styles from './index.module.css'  // ✅ Vite 推薦
```

## 哪些項目不適合遷移

- 高度依賴 Webpack 插件生態的（Module Federation、特殊 loader）
- 遺留的 CommonJS 項目（Vite 開發環境用 ESM）
- 需要兼容 IE11 的項目（Vite 不支持）

## 小結

- Webpack 調優能從 45s 降到 6s，但有天花板
- Vite 從根本上改變了開發體驗：按需編譯 + esbuild 預構建
- 新項目直接用 Vite，老項目評估 Webpack 插件依賴後決定是否遷移
- 生產構建兩者差距不大，Vite 的 Rollup tree-shaking 略有優勢
- 2021 年，Vite 已經是 Vue 3 項目的事實標準