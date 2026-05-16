---
title: "Vite 3: The Watershed Moment for Frontend Build Tools"
date: 2022-02-08 10:39:57
tags:
  - Vite
readingTime: 2
description: "Vite 3 发布了。从 Vite 2 到 3，不只是版本号的变化——冷启动速度更快、开发体验更好、插件生态更成熟。作为团队构建基础设施的技术选型负责人，这篇文章聊聊 Vite 3 的核心变化和我们的迁移经验。"
---

Vite 3 发布了。从 Vite 2 到 3，不只是版本号的变化——冷启动速度更快、开发体验更好、插件生态更成熟。作为团队构建基础设施的技术选型负责人，这篇文章聊聊 Vite 3 的核心变化和我们的迁移经验。

## 核心改进

### 冷启动优化

Vite 3 的开发服务器冷启动比 Vite 2 快了不少。主要优化：

```bash
# Vite 3 使用 esbuild 做依赖预构建，但优化了缓存策略
vite --force  # 强制重新预构建（清除缓存）

# 查看预构建分析
DEBUG=vite:deps npx vite
```

### 内置的 CSS Modules 支持

```css
/* styles.module.css */
.container {
  background: #f5f5f5;
}

/* 自动支持 CSS Modules，不需要额外配置 */
```

```typescript
// 直接导入
import styles from './styles.module.css';

// 带类型支持（配合 vite-plugin-css-modules-types）
const cls = styles.container;
```

### 构建优化

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
  // Vite 3 新增：开发服务器配置
  server: {
    // 更快的 HMR
    hmr: {
      overlay: true,
    },
  },
});
```

## 插件生态

Vite 3 的插件生态已经成熟。我们常用的核心插件：

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

    // TypeScript 类型检查（不阻塞编译）
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint src --ext .ts,.tsx',
      },
    }),

    // 图片压缩
    ViteImageOptimizer({
      jpeg: { quality: 80 },
      png: { quality: 80 },
    }),

    // 调试插件（查看中间状态）
    Inspect(),
  ],
});
```

## 从 Webpack 迁移的实战

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
    svgr(),  // SVG 作为 React 组件导入
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

### 环境变量迁移

```bash
# Webpack: .env 中用 REACT_APP_ 前缀
REACT_APP_API_URL=https://api.example.com

# Vite: 改为 VITE_ 前缀
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

## Performance Comparison

我们一个中型后台项目（200+ 页面组件）的实测数据：

| 指标 | Webpack 5 | Vite 2 | Vite 3 |
|------|-----------|--------|--------|
| 冷启动 | 45s | 3.2s | 2.1s |
| HMR | 800ms | 28ms | 18ms |
| 生产构建 | 120s | 35s | 28s |

冷启动提升最明显，开发体验质的飞跃。

## Summary

Vite 3 标志着前端构建工具进入新阶段。基于浏览器原生 ESM 的开发模式已经被验证是可行的。对于新项目，没有理由不用 Vite。对于老项目，迁移成本不高，收益明显。接下来我会写 Vitest——Vite 原生的测试框架，配合 Vite 组成完整的工具链。