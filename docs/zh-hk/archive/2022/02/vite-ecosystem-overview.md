---
title: "Vite 3：前端構建工具的分水嶺"
date: 2022-02-08 10:39:57
tags:
  - Vite
readingTime: 2
description: "Vite 3 發佈了。從 Vite 2 到 3，不只是版本號的變化——冷啓動速度更快、開發體驗更好、插件生態更成熟。作為團隊構建基礎設施的技術選型負責人，這篇文章聊聊 Vite 3 的核心變化和我們的遷移經驗。"
---

Vite 3 發佈了。從 Vite 2 到 3，不只是版本號的變化——冷啓動速度更快、開發體驗更好、插件生態更成熟。作為團隊構建基礎設施的技術選型負責人，這篇文章聊聊 Vite 3 的核心變化和我們的遷移經驗。

## 核心改進

### 冷啓動優化

Vite 3 的開發服務器冷啓動比 Vite 2 快了不少。主要優化：

```bash
# Vite 3 使用 esbuild 做依賴預構建，但優化了緩存策略
vite --force  # 強制重新預構建（清除緩存）

# 查看預構建分析
DEBUG=vite:deps npx vite
```

### 內置的 CSS Modules 支持

```css
/* styles.module.css */
.container {
  background: #f5f5f5;
}

/* 自動支持 CSS Modules，不需要額外配置 */
```

```typescript
// 直接導入
import styles from './styles.module.css';

// 帶類型支持（配合 vite-plugin-css-modules-types）
const cls = styles.container;
```

### 構建優化

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 3 支持 CSS code splitting
    cssCodeSplit: true,
    // 更好的 sourcemap 支持
    sourcemap: true,
    // rollup 打包配置
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  // Vite 3 新增：開發服務器配置
  server: {
    // 更快的 HMR
    hmr: {
      overlay: true,
    },
  },
});
```

## 插件生態

Vite 3 的插件生態已經成熟。我們常用的核心插件：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import Inspect from 'vite-plugin-inspect';

export default defineConfig({
  plugins: [
    react(),

    // TypeScript 類型檢查（不阻塞編譯）
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint src --ext .ts,.tsx',
      },
    }),

    // 圖片壓縮
    ViteImageOptimizer({
      jpeg: { quality: 80 },
      png: { quality: 80 },
    }),

    // 調試插件（查看中間狀態）
    Inspect(),
  ],
});
```

## 從 Webpack 遷移的實戰

```typescript
// webpack.config.js → vite.config.ts

// Before (Webpack):
// module.exports = {
//   resolve: { alias: { '@': path.resolve('src') } },
//   module: { rules: [{ test: /\.svg/, use: ['@svgr/webpack'] }] },
//   plugins: [new HtmlWebpackPlugin(), new DefinePlugin({...})],
//   devServer: { port: 3000, proxy: { '/api': 'http://localhost:8080' } },
// };

// After (Vite):
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    svgr(),  // SVG 作為 React 組件導入
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
  css: {
    preprocessorOptions: {
      less: {
        modifyVars: { '@primary-color': '#1890ff' },
        javascriptEnabled: true,
      },
    },
  },
});
```

### 環境變量遷移

```bash
# Webpack: .env 中用 REACT_APP_ 前綴
REACT_APP_API_URL=https://api.example.com

# Vite: 改為 VITE_ 前綴
VITE_API_URL=https://api.example.com
```

```typescript
// Before
const url = process.env.REACT_APP_API_URL;

// After
const url = import.meta.env.VITE_API_URL;
```

## Monorepo 中的 Vite 配置共享

```typescript
// packages/vite-config/index.ts
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export function createViteConfig(
  overrides: Partial<UserConfig> = {}
): UserConfig {
  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve('src') },
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
    },
    ...overrides,
  });
}

// apps/admin/vite.config.ts
import { createViteConfig } from '@mono/vite-config';

export default createViteConfig({
  server: { port: 3001 },
  build: {
    outDir: 'dist/admin',
  },
});
```

## 性能對比

我們一箇中型後台項目（200+ 頁面組件）的實測數據：

| 指標 | Webpack 5 | Vite 2 | Vite 3 |
|
------|-----------|--------|--------|
| 冷啓動 | 45s | 3.2s | 2.1s |
| HMR | 800ms | 28ms | 18ms |
| 生產構建 | 120s | 35s | 28s |

冷啓動提升最明顯，開發體驗質的飛躍。

## 小結

Vite 3 標誌着前端構建工具進入新階段。基於瀏覽器原生 ESM 的開發模式已經被驗證是可行的。對於新項目，沒有理由不用 Vite。對於老項目，遷移成本不高，收益明顯。接下來我會寫 Vitest——Vite 原生的測試框架，配合 Vite 組成完整的工具鏈。