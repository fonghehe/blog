---
title: "2022 Year-End Review: The Shifting Landscape of Frontend Toolchains"
date: 2022-12-20 11:47:19
tags:
  - Frontend
readingTime: 3
description: "2022 年是前端工具链剧烈变化的一年。Vite 成为主流构建工具、pnnpm + Turborepo 定义了 monorepo 的标准方案、ESM 迁移进入实质阶段。这篇文章做个年终总结。"
wordCount: 577
---

2022 年是前端工具链剧烈变化的一年。Vite 成为主流构建工具、pnnpm + Turborepo 定义了 monorepo 的标准方案、ESM 迁移进入实质阶段。这篇文章做个年终总结。

## Build Tools: Vite Unifies the Dev Experience

年初我们还在用 Webpack，年底所有新项目都跑在 Vite 上。

```typescript
// 2022 年初的 Webpack 配置
module.exports = {
  entry: './src/index.tsx',
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  devServer: { port: 3000 },
  // 启动耗时：45 秒
};

// 2022 年底的 Vite 配置
export default defineConfig({
  plugins: [react()],
  // 启动耗时：2 秒
});
```

Vite 3 的发布巩固了它的地位。esbuild 做依赖预构建、原生 ESM 做开发模式——这个架构被证明是正确的。

## Monorepo: pnpm + Turborepo Combination

2022 年我们完成了 monorepo 的标准化：

| 工具 | 职责 |
|------|------|
| pnpm | 依赖管理、workspace 管理 |
| Turborepo | 构建编排、缓存 |
| Changesets | 版本管理、发布 |
| TypeScript Project References | 类型检查 |

```json
// 一个典型的前端 monorepo
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "release": "changeset publish"
  }
}
```

## Testing: Vitest Takes Over from Jest

Vitest 的优势太明显了——和 Vite 共享配置、原生 ESM、速度快 3 倍。我们把 5 个项目从 Jest 迁移到 Vitest，平均耗时半天。

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

## CSS Solutions: The Rise of UnoCSS

Tailwind 仍然主导市场，但 UnoCSS 在我们团队获得了更好的体验：

- 按需生成，CSS 体积更小
- 图标预设解决了图标管理问题
- 自定义规则能力让组件库样式更灵活

```html
<!-- UnoCSS：属性化模式 + 图标预设 -->
<button px-4 py-2 bg-blue-500 text-white rounded>
  <i class="i-mdi-check mr-2"></i>
  确认
</button>
```

## Runtime: A Three-Way Battle

```
Node.js 18 LTS  —— 生产环境的标准
Deno 1.x       —— 边缘计算和实验
Bun 0.1.x      —— 令人兴奋的挑战者
```

Node.js 18 内置 fetch 和测试运行器，减少了对第三方依赖的需求。Bun 的速度表现令人印象深刻，但还不适合生产环境。

## Framework Ecosystem

```
React 18    —— 并发特性落地（useTransition, useDeferredValue）
Next.js 13  —— App Router 预览（Server Components）
Vue 3.2     —— 稳定成熟，生态丰富
SvelteKit   —— 全栈能力
Astro 1.0   —— 内容站首选
Solid.js    —— 性能标杆
```

React 18 的并发特性让性能优化从「手动优化」变成「框架帮你优化」。Next.js 13 的 App Router 预示了 SSR 的未来方向。

## TypeScript

TypeScript 从 4.6 演进到 4.9，每一步都在解决实际问题：

- 4.6：解构不破坏控制流
- 4.7：ESM 支持（module: NodeNext）
- 4.8：类型收窄增强
- 4.9：satisfies 操作符

```typescript
// satisfies 是今年最好的 TypeScript 特性
const routes = {
  '/': HomePage,
  '/about': AboutPage,
  '/users/[id]': UserPage,
} satisfies Record<string, ComponentType>;

// routes['/'] 的类型是 ComponentType，不是泛化的 ComponentType
```

## My 2022 Recommended Toolchain

```json
{
  "runtime": "Node.js 18",
  "packageManager": "pnpm 7",
  "monorepo": "pnpm workspace + Turborepo",
  "bundler": "Vite 3",
  "testing": "Vitest",
  "css": "UnoCSS",
  "framework": "React 18 / Next.js 13",
  "language": "TypeScript 4.9"
}
```

## Looking Ahead to 2023

几个值得关注的方向：
1. **Bun 正式版**：能否改变 JavaScript 工具链格局
2. **Next.js 13 稳定版**：App Router 是否能被广泛接受
3. **Rust 工具链**：SWC、Rspack、Biome 等基于 Rust 的工具
4. **CSS 新特性**：Container Queries 广泛落地

## Summary

2022 年前端工具链的主题是「收敛」——Vite 统一构建、pnpm 统一包管理、Vitest 统一测试。碎片化在减少，开发者体验在提升。作为基础设施搭建者，今年的工作让团队的开发效率有了质的飞跃。