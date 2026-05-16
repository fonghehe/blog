---
title: "Vite 2.0: A Production-Ready Next-Generation Build Tool"
date: 2021-02-20 10:45:12
tags:
  - Vite
  - Engineering
  - Vue
  - JavaScript
  - TypeScript

readingTime: 1
description: "Vite 2.0 正式发布！和 1.0 相比几乎是重写，最重要的变化是框架无关（不再绑定 Vue）。"
---

Vite 2.0 正式发布！和 1.0 相比几乎是重写，最重要的变化是框架无关（不再绑定 Vue）。

## Core Improvements

**框架无关**

```bash
# Vue 3
npm init vite@latest my-app -- --template vue-ts

# React
npm init vite@latest my-app -- --template react-ts

# Svelte
npm init vite@latest my-app -- --template svelte-ts
```

**插件 API 兼容 Rollup**

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

## Real Project Migration: From Vue CLI to Vite

```bash
# 删除 Vue CLI 依赖
npm uninstall @vue/cli-service @vue/cli-plugin-babel @vue/cli-plugin-typescript

# 安装 Vite
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

// .env 文件前缀也变了
// 以前：VUE_APP_*
// Vite：VITE_*
```

**踩坑：require() 不可用**

```javascript
// ❌ Vite 不支持 CommonJS require
const path = require("path");
const img = require("./image.png");

// ✅ 使用 ESM
import { resolve } from "path";
// 图片用 import 或者 new URL()
import img from "./image.png";
const img = new URL("./image.png", import.meta.url).href;
```

## Developer Experience Comparison

|            | Vue CLI (Webpack 4) | Vite 2         |
| ---------- | ------------------- | -------------- |
| 冷启动     | ~60s                | ~1s            |
| HMR        | ~2s                 | ~50ms          |
| 生产构建   | ~80s                | ~30s（Rollup） |
| 配置复杂度 | 高                  | 低             |

冷启动的差距在大项目里特别明显。

## SSR 支持

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

Vite 2 的 SSR 支持虽然还不够完善（和 Nuxt 比），但为 Nuxt 3 奠定了基础。

## Summary

- Vite 2 最大变化：框架无关，Vue/React/Svelte 都支持
- 迁移要注意：`process.env` → `import.meta.env`，`require` → `import`
- 开发体验提升显著，新项目推荐用 Vite 替代 Vue CLI / Create React App
- SSR 还不完善，需要 Nuxt 3 / Remix 等上层框架
