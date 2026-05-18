---
title: "Vite 2.0：生產級別的下一代構建工具"
date: 2021-02-20 10:45:12
tags:
  - Vue
  - React
  - Webpack
  - Vite
  - TypeScript
  - JavaScript
readingTime: 1
description: "Vite 2.0 正式釋出！和 1.0 相比幾乎是重寫，最重要的變化是框架無關（不再繫結 Vue）。"
---

Vite 2.0 正式釋出！和 1.0 相比幾乎是重寫，最重要的變化是框架無關（不再繫結 Vue）。

## 核心改進

**框架無關**

```bash
# Vue 3
npm init vite@latest my-app -- --template vue-ts

# React
npm init vite@latest my-app -- --template react-ts

# Svelte
npm init vite@latest my-app -- --template svelte-ts
```

**外掛 API 相容 Rollup**

```javascript
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia"],
          utils: ["axios", "dayjs", "lodash-es"],
        },
      },
    },
  },
});
```

## 實際專案遷移：從 Vue CLI 到 Vite

```bash
# 刪除 Vue CLI 依賴
npm uninstall @vue/cli-service @vue/cli-plugin-babel @vue/cli-plugin-typescript

# 安裝 Vite
npm install -D vite @vitejs/plugin-vue

# 修改 package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

**踩坑：process.env 不可用**

```javascript
// Vue CLI（Webpack）：使用 process.env
const API_URL = process.env.VUE_APP_API_URL;

// Vite：使用 import.meta.env
const API_URL = import.meta.env.VITE_API_URL;

// .env 檔案字首也變了
// 以前：VUE_APP_*
// Vite：VITE_*
```

**踩坑：require() 不可用**

```javascript
// ❌ Vite 不支援 CommonJS require
const path = require("path");
const img = require("./image.png");

// ✅ 使用 ESM
import { resolve } from "path";
// 圖片用 import 或者 new URL()
import img from "./image.png";
const img = new URL("./image.png", import.meta.url).href;
```

## 開發體驗對比

|            | Vue CLI (Webpack 4) | Vite 2         |
| 
---------- | ------------------- | -------------- |
| 冷啟動     | ~60s                | ~1s            |
| HMR        | ~2s                 | ~50ms          |
| 生產構建   | ~80s                | ~30s（Rollup） |
| 配置複雜度 | 高                  | 低             |

冷啟動的差距在大專案裡特別明顯。

## SSR 支援

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    ssr: true,
    rollupOptions: {
      input: "src/entry-server.ts",
    },
  },
});
```

Vite 2 的 SSR 支援雖然還不夠完善（和 Nuxt 比），但為 Nuxt 3 奠定了基礎。

## 小結

- Vite 2 最大變化：框架無關，Vue/React/Svelte 都支援
- 遷移要注意：`process.env` → `import.meta.env`，`require` → `import`
- 開發體驗提升顯著，新專案推薦用 Vite 替代 Vue CLI / Create React App
- SSR 還不完善，需要 Nuxt 3 / Remix 等上層框架
