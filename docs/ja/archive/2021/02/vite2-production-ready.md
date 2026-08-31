---
title: "Vite 2.0：本番対応の次世代ビルドツール"
date: 2021-02-20 10:45:12
tags:
  - Vite
  - エンジニアリング
  - Vue
  - JavaScript
  - TypeScript

readingTime: 2
description: "Vite 2.0 正式发布！和 1.0 相比几乎是重写，最重要的变化是框架无关（不再绑定 Vue）。"
wordCount: 360
---

Vite 2.0 が正式リリースされた！1.0 と比べてほぼ書き直されており、最大の変更点はフレームワーク非依存（Vue 専用ではなくなった）になったことだ。

## コアの改善

**フレームワーク非依存**

```bash
# Vue 3
npm init vite@latest my-app -- --template vue-ts

# React
npm init vite@latest my-app -- --template react-ts

# Svelte
npm init vite@latest my-app -- --template svelte-ts
```

**プラグイン API が Rollup と互換**

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

## 実際のプロジェクト移行：Vue CLI から Vite へ

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

**つまずきポイント：process.env が使えない**

```javascript
// Vue CLI（Webpack）：使用 process.env
const API_URL = process.env.VUE_APP_API_URL;

// Vite：使用 import.meta.env
const API_URL = import.meta.env.VITE_API_URL;

// .env 文件前缀也变了
// 以前：VUE_APP_*
// Vite：VITE_*
```

**つまずきポイント：require() が使えない**

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

## 開発者体験の比較

|            | Vue CLI (Webpack 4) | Vite 2         |
| ---------- | ------------------- | -------------- |
| 冷启动     | ~60s                | ~1s            |
| HMR        | ~2s                 | ~50ms          |
| 生产构建   | ~80s                | ~30s（Rollup） |
| 配置复杂度 | 高                  | 低             |

コールドスタートの差は大規模なプロジェクトで特に顕著だ。

## SSR 対応

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

Vite 2 の SSR 対応はまだ十分に成熟していない（Nuxt と比べると）が、Nuxt 3 の基礎を築いた。

## まとめ

- Vite 2 最大の変化：フレームワーク非依存となり、Vue/React/Svelte すべてに対応。
- 移行時の注意点：`process.env` → `import.meta.env`、`require` → `import` に変える。
- 開発体験の向上は著しく、新規プロジェクトでは Vue CLI / Create React App の代わりに Vite を使うことを推奨する。
- SSR はまだ成熟しておらず、Nuxt 3 / Remix などの上位フレームワークが必要だ。
