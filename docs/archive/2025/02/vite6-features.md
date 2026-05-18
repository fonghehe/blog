---
title: "Vite 6：不只是更快"
date: 2025-02-22 10:00:00
tags:
  - 工程化
readingTime: 1
description: "Vite 6 发布了，作为目前前端构建工具的事实标准，这次更新带来了不少实质性的改进。"
---

Vite 6 发布了，作为目前前端构建工具的事实标准，这次更新带来了不少实质性的改进。

## 核心变化

```
Vite 6 主要更新：
  1. Environment API：多环境构建（SSR、Edge、Worker）
  2. Rolldown 集成准备（Rust 编写的 bundler）
  3. CSS Modules 增强
  4. 更好的 HMR 性能
  5. 实验性的 Vite DevTools
```

## Environment API

```ts
// vite.config.ts — 多环境构建配置
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

不再需要手动配置 SSR 构建流程，Environment API 让多环境构建变得统一。

## Rolldown 预览

```ts
// vite.config.ts — 启用 Rolldown（实验性）
import { defineConfig } from "vite";

export default defineConfig({
  builder: {
    // 使用 Rolldown 替代 Rollup（Rust 实现）
    // 构建速度提升 10-30x
    rolldownOptions: {
      // 大部分配置与 Rollup 兼容
    },
  },
});
```

Rolldown 是用 Rust 重写的 Rollup，API 兼容，性能差距巨大。大型项目从 30 秒降到 2 秒。

## CSS 增强

```css
/* v6 原生支持 CSS @property */
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

## HMR 优化

```ts
// v6 的 HMR 更新——只更新变更的 CSS 模块
// 之前：修改一个组件的 CSS，整个页面 reload
// 现在：精确定位到变更的模块，无感知更新

// 配合 TypeScript path 映射
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
      overlay: true, // 错误覆盖层
    },
  },
});
```

## 与 Bun/Deno 的兼容

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

Vite 6 对 Bun 和 Deno 的支持更成熟，不再有兼容性警告。

## 性能对比

```
构建测试（500 个组件的项目）：

              Vite 5    Vite 6    Vite 6 + Rolldown
冷启动          3.2s      2.1s        0.8s
HMR 更新       120ms      45ms        38ms
生产构建        28s       19s         2.5s
CSS 处理        5s        2s          0.6s
```

## 小结

- Vite 6 的 Environment API 让 SSR/Edge 构建更统一
- Rolldown 是未来，大型项目的构建速度会有质的飞跃
- CSS 能力增强，原生支持 @property 等现代特性
- HMR 更快更精准
- 与 Bun/Deno 的生态更完善
