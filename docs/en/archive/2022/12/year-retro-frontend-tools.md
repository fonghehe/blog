---
title: "2022 Year-End Review: The Shifting Landscape of Frontend Toolchains"
date: 2022-12-20 11:47:19
tags:
  - Frontend
readingTime: 2
description: "2022 was a year of dramatic change in frontend toolchains. Vite became the mainstream build tool, pnpm + Turborepo defined the standard monorepo solution, and the ESM migration entered its substantive phase. This article wraps up the year with a retrospective."
wordCount: 384
---

2022 was a year of dramatic change in frontend toolchains. Vite became the mainstream build tool, pnpm + Turborepo defined the standard monorepo solution, and the ESM migration entered its substantive phase. This article wraps up the year with a retrospective.

## Build Tools: Vite Unifies the Dev Experience

At the start of the year we were still on Webpack; by year-end every new project was running on Vite.

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

The release of Vite 3 cemented its position. esbuild for dependency pre-bundling, native ESM for dev mode — this architecture proved to be the right call.

## Monorepo: pnpm + Turborepo Combination

In 2022 we standardized our monorepo setup:

| Tool | Responsibility |
|------|------|
| pnpm | Dependency management, workspace management |
| Turborepo | Build orchestration, caching |
| Changesets | Versioning, publishing |
| TypeScript Project References | Type checking |

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

Vitest's advantages are too obvious to ignore — shared config with Vite, native ESM, 3x faster. We migrated five projects from Jest to Vitest, each taking about half a day on average.

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

Tailwind still dominates the market, but UnoCSS gave our team a better experience:

- On-demand generation, smaller CSS output
- Icon presets solved icon management headaches
- Custom rules made component library styling more flexible

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

Node.js 18 ships with built-in fetch and a test runner, reducing the need for third-party dependencies. Bun's speed benchmarks are impressive, but it's not production-ready yet.

## Framework Ecosystem

```
React 18    —— 并发特性落地（useTransition, useDeferredValue）
Next.js 13  —— App Router 预览（Server Components）
Vue 3.2     —— 稳定成熟，生态丰富
SvelteKit   —— 全栈能力
Astro 1.0   —— 内容站首选
Solid.js    —— 性能标杆
```

React 18's concurrent features shifted performance optimization from "manual tuning" to "the framework optimizes for you." Next.js 13's App Router signaled the future direction of SSR.

## TypeScript

TypeScript evolved from 4.6 to 4.9, each release solving real-world problems:

- 4.6: Destructuring preserves control flow narrowing
- 4.7: ESM support (module: NodeNext)
- 4.8: Improved type narrowing
- 4.9: satisfies operator

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

A few directions worth watching:
1. **Bun 1.0**: Can it reshape the JavaScript toolchain landscape?
2. **Next.js 13 stable**: Will App Router gain widespread adoption?
3. **Rust-based toolchains**: SWC, Rspack, Biome and other Rust-powered tools
4. **New CSS features**: Container Queries landing broadly

## Summary

The overarching theme of 2022 frontend toolchains was "convergence" — Vite unifying builds, pnpm unifying package management, Vitest unifying testing. Fragmentation is shrinking and developer experience is improving. As the team's infrastructure builder, this year's work gave our development efficiency a qualitative leap.