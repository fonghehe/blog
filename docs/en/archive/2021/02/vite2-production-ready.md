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
description: "Vite 2.0 is officially out! Compared with 1.0 it is almost a full rewrite, and the most important change is that it is framework-agnostic — no longer tied to Vue."
wordCount: 177
---

Vite 2.0 is officially released! Compared to 1.0 it's almost a complete rewrite, and the biggest change is that it's now framework-agnostic (no longer tied to Vue).

## Core Improvements

**Framework-agnostic**

```bash
# Vue 3
npm init vite@latest my-app -- --template vue-ts

# React
npm init vite@latest my-app -- --template react-ts

# Svelte
npm init vite@latest my-app -- --template svelte-ts
```

**Plugin API Compatible with Rollup**

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

**Gotcha: `process.env` Is Unavailable**

```javascript
// Vue CLI（Webpack）：使用 process.env
const API_URL = process.env.VUE_APP_API_URL;

// Vite：使用 import.meta.env
const API_URL = import.meta.env.VITE_API_URL;

// .env 文件前缀也变了
// 以前：VUE_APP_*
// Vite：VITE_*
```

**Gotcha: `require()` Is Unavailable**

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

The cold-start gap is especially noticeable in large projects.

## SSR Support

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

Vite 2's SSR support is still incomplete (compared to Nuxt), but it laid the groundwork for Nuxt 3.

## Summary

- The biggest change in Vite 2 is that it's framework-agnostic: Vue, React, and Svelte are all supported.
- When migrating, watch out for: `process.env` → `import.meta.env`, and `require` → `import`.
- The developer experience improves significantly — for new projects, Vite is the recommended replacement for Vue CLI / Create React App.
- SSR is still incomplete and relies on an upper-layer framework such as Nuxt 3 / Remix.
