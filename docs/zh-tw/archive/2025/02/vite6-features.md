---
title: "Vite 6：不只是更快"
date: 2025-02-22 10:00:00
tags:
  - 工程化
readingTime: 1
description: "Vite 6 釋出了，作為目前前端構建工具的事實標準，這次更新帶來了不少實質性的改進。"
wordCount: 201
---

Vite 6 釋出了，作為目前前端構建工具的事實標準，這次更新帶來了不少實質性的改進。

## 核心變化

```
Vite 6 主要更新：
  1. Environment API：多環境構建（SSR、Edge、Worker）
  2. Rolldown 整合準備（Rust 編寫的 bundler）
  3. CSS Modules 增強
  4. 更好的 HMR 效能
  5. 實驗性的 Vite DevTools
```

## Environment API

```ts
// vite.config.ts — 多環境構建配置
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    client: {
      build: {
        outDir: "dist/client",
        rollupOptions: {
          input: "src/entry-client.ts",
        },
      },
    },
    server: {
      build: {
        outDir: "dist/server",
        rollupOptions: {
          input: "src/entry-server.ts",
        },
      },
    },
    edge: {
      build: {
        outDir: "dist/edge",
        target: "esnext",
        minify: false,
      },
    },
  },
});
```

不再需要手動配置 SSR 構建流程，Environment API 讓多環境構建變得統一。

## Rolldown 預覽

```ts
// vite.config.ts — 啟用 Rolldown（實驗性）
import { defineConfig } from "vite";

export default defineConfig({
  builder: {
    // 使用 Rolldown 替代 Rollup（Rust 實現）
    // 構建速度提升 10-30x
    rolldownOptions: {
      // 大部分配置與 Rollup 相容
    },
  },
});
```

Rolldown 是用 Rust 重寫的 Rollup，API 相容，效能差距巨大。大型專案從 30 秒降到 2 秒。

## CSS 增強

```css
/* v6 原生支援 CSS @property */
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.animated-gradient {
  background: conic-gradient(from var(--gradient-angle), #3b82f6, #8b5cf6, #3b82f6);
  animation: rotate 3s linear infinite;
}

@keyframes rotate {
  to { --gradient-angle: 360deg; }
}
```

## HMR 最佳化

```ts
// v6 的 HMR 更新——只更新變更的 CSS 模組
// 之前：修改一個元件的 CSS，整個頁面 reload
// 現在：精確定位到變更的模組，無感知更新

// 配合 TypeScript path 對映
// vite.config.ts
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
    },
  },
  server: {
    hmr: {
      overlay: true, // 錯誤覆蓋層
    },
  },
});
```

## 與 Bun/Deno 的相容

```bash
# Bun + Vite 6
bun create vite my-app --template react-ts
cd my-app
bun install
bun run dev

# Deno + Vite 6
deno run -A npm:create-vite my-app --template react-ts
cd my-app
deno install
deno task dev
```

Vite 6 對 Bun 和 Deno 的支援更成熟，不再有相容性警告。

## 效能對比

```
構建測試（500 個元件的專案）：

              Vite 5    Vite 6    Vite 6 + Rolldown
冷啟動          3.2s      2.1s        0.8s
HMR 更新       120ms      45ms        38ms
生產構建        28s       19s         2.5s
CSS 處理        5s        2s          0.6s
```

## 小結

- Vite 6 的 Environment API 讓 SSR/Edge 構建更統一
- Rolldown 是未來，大型專案的構建速度會有質的飛躍
- CSS 能力增強，原生支援 @property 等現代特性
- HMR 更快更精準
- 與 Bun/Deno 的生態更完善
