---
title: "2020 年前端構建工具橫評：webpack vs Rollup vs esbuild vs Vite"
date: 2020-12-26 15:43:36
tags:
  - Node.js
readingTime: 3
description: "2020 年前端構建工具領域發生了不小的變化：webpack 5 正式發佈，esbuild 憑藉 Go 語言實現的極速打包引發關注，Vite 帶來了全新的 No-bundle 開發服務器方案。是時候系統地梳理這四個工具的定位和適用場景了。"
---

2020 年前端構建工具領域發生了不小的變化：webpack 5 正式發佈，esbuild 憑藉 Go 語言實現的極速打包引發關注，Vite 帶來了全新的 No-bundle 開發服務器方案。是時候系統地梳理這四個工具的定位和適用場景了。

## 核心定位對比

| 工具      | 定位             | 底層語言              | 主要優勢                    |
| 
--------- | ---------------- | --------------------- | --------------------------- |
| webpack 5 | 應用打包         | JavaScript            | 生態成熟、功能完整          |
| Rollup    | 庫打包           | JavaScript            | Tree-shaking 極佳、輸出乾淨 |
| esbuild   | 極速轉換/打包    | Go                    | 速度領先 10-100x            |
| Vite      | 下一代開發服務器 | JS + Rollup + esbuild | 開發極速，生產用 Rollup     |

## webpack 5：成熟的應用打包器

**2020 年 10 月正式發佈 webpack 5**，核心改進：

```javascript
// webpack.config.js
module.exports = {
  // 1. 持久化緩存（增量構建）
  cache: {
    type: "filesystem", // 緩存到磁盤
    buildDependencies: {
      config: [__filename], // 配置變更時緩存失效
    },
  },

  // 2. Module Federation（微前端）
  plugins: [
    new ModuleFederationPlugin({
      name: "app1",
      exposes: {
        "./Button": "./src/Button", // 暴露組件給其他應用
      },
    }),
  ],

  // 3. Asset Modules（替代 file-loader/url-loader）
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif)$/,
        type: "asset/resource", // 替代 file-loader
      },
    ],
  },
};
```

**適用場景**：大型複雜應用、需要 Module Federation 的微前端、已有 webpack 生態的項目。

## Rollup：庫打包的首選

```javascript
// rollup.config.js
export default {
  input: "src/index.ts",
  output: [
    { file: "dist/index.cjs.js", format: "cjs" }, // Node.js
    { file: "dist/index.esm.js", format: "esm" }, // ES Module
    { file: "dist/index.umd.js", format: "umd", name: "MyLib" }, // 瀏覽器
  ],
  plugins: [typescript(), resolve(), commonjs()],
  external: ["react", "lodash"], // peer dependencies 不打包進去
};
```

Rollup 的 tree-shaking 是業界標杆，生成的代碼乾淨簡潔，適合發佈 npm 包。Vue 3、React 本身都用 Rollup 打包。

**適用場景**：組件庫、工具函數庫、任何要發佈到 npm 的包。

## esbuild：速度怪獸

```javascript
// 用 esbuild API 打包
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    outfile: "dist/bundle.js",
    platform: "browser",
    target: ["chrome80", "firefox78"],
  })
  .catch(() => process.exit(1));
```

速度對比（對一箇中型項目，含 1000 個模塊）：

| 工具      | 冷構建時間 |
| --------- | ---------- |
| webpack 5 | ~8s        |
| Rollup    | ~4s        |
| esbuild   | ~0.3s      |

但 esbuild 目前不支持代碼分割（code splitting）、不支持 CSS modules 等特性，生態不夠完整，適合作為其他工具的底層（Vite 用它預構建依賴）。

**適用場景**：作為其他工具的底層（Vite、Parcel）、需要極速 TS 轉 JS、CI 中的快速構建。

## Vite：開發體驗革命

```javascript
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // 生產構建仍用 Rollup
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
});
```

Vite 的本質是：**開發時用 esbuild 預處理 + 原生 ESM，生產時用 Rollup 打包**。

**適用場景**：新項目的開發服務器、Vue 3 + Vite 官方搭配、追求極速開發啓動。

## 選型建議

```
新的應用項目？
  ├── 追求開發速度 → Vite（開發），Rollup（生產）
  └── 需要 IE 兼容 / 複雜微前端 → webpack 5

開發 npm 庫？
  └── Rollup（首選）

構建工具的底層處理器？
  └── esbuild（速度優先）

已有 webpack 項目？
  └── 升級 webpack 5（開啓持久化緩存可減少 60% 構建時間）
```

## 總結

2020 年構建工具的格局變化預示着一個趨勢：**開發體驗和構建速度將成為核心競爭力**。esbuild 的速度和 Vite 的理念已經影響了整個生態——webpack 5 的持久化緩存、SWC 的出現，都是對這一趨勢的響應。
