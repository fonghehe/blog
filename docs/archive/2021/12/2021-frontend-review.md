---
title: "2021 前端生态回顾：Vite 之年"
date: 2021-12-13 16:06:07
tags:
  - 前端
---

2021 年快结束了，整理一下这一年前端生态的重要变化。如果用一个词总结 2021 的前端，我会选"Vite"。

## 构建工具：Vite 成为事实标准

2021 年初，Vite 2.0 发布，年底已经成为 Vue 3 和越来越多 React 项目的默认选择。

**关键节点：**
- 2 月：Vite 2.0 正式发布，采用 ESM + esbuild 预构建的架构
- 6 月：SvelteKit 默认使用 Vite
- 9 月：Vite 团队发布 Vitest 设计方案
- 12 月：Vite 生态插件超过 300 个

Vite 改变了前端对"开发服务器"的认知：不打包也能开发，按需编译才是正道。

```bash
# Webpack 时代的启动
npm run dev    # 等待 30s...

# Vite 时代的启动
npm run dev    # < 1s
```

Webpack 5 在今年也做了不少优化（持久缓存、Module Federation），但开发体验的差距已经拉开。

## 框架格局

### Vue 生态

- **Vue 3.2**：`<script setup>` 标记为稳定，编译时宏成为推荐写法
- **Pinia**：成为 Vue 状态管理的推荐方案，Vuex 5 会基于 Pinia 重新设计
- **VitePress**：文档站生成器，替代 VuePress
- **Nuxt 3**：10 月发布 RC，基于 Vite + Nitro 服务引擎

### React 生态

- **React 18**：Alpha → Beta，年底进入 RC 阶段
- **Concurrent 特性**：`useTransition`、`useDeferredValue`、Automatic Batching
- **Suspense SSR**：流式渲染 + 选择性注水
- **Next.js 12**：Rust 编译器（SWC）、Middleware、React 18 支持
- **Remix**：11 月开源，挑战 Next.js

### 新兴框架

- **Solid.js**：类 React 语法，无虚拟 DOM，性能极佳
- **Qwik**：可恢复性（Resumability）概念，0 JS 的交互性
- **Astro**：岛屿架构，部分水合

## CSS 的变化

- **Tailwind CSS 3.0**：JIT 成为默认模式，任意值支持
- **CSS Container Queries**：Chrome Canary 实验性支持
- **Lightning CSS**：Rust 写的 CSS 工具链（Parcel 2 使用）
- **UnoCSS**：Anthony Fu 发布的原子化 CSS 引擎，性能优于 Windi CSS

## TypeScript

- **TypeScript 4.4**：控制流分析改进、`exactOptionalPropertyTypes`
- **TypeScript 4.5**：`Awaited` 类型、`type` 修饰符导入
- 类型体操社区活跃：`type-fest`、`ts-toolbelt`

## 工具链

### 包管理

- **pnpm**：2021 年增长最快的包管理器，节省磁盘空间 + 严格的依赖隔离
- **Corepack**：Node.js 内置包管理器管理工具

### Monorepo

- **Turborepo**：12 月开源，Vercel 收购并开源，Go 写的高性能构建编排
- **Nx**：持续迭代，12.9 版本支持 Vite executor
- **pnpm workspace**：成为最轻量的 Monorepo 方案

### 测试

- **Vitest**：概念形成，年底发布 beta，基于 Vite 的单元测试框架
- **Playwright**：E2E 测试的新宠，微软出品，跨浏览器支持好
- **Testing Library**：成为 React 组件测试的主流方案

## 运行时

- **Deno 1.15**：兼容性提升，npm 包兼容层改进
- **Bun**：Jarred Sumner 开始用 Zig 写新的 JS 运行时（年底预告）
- **Node.js 16 LTS**：10 月成为 LTS 版本

## 值得关注的趋势

### 1. Rust 重写前端工具链

esbuild、SWC、Rome、Lightning CSS……用 Rust 或 Go 重写 JavaScript 工具链的趋势不可逆。10 倍以上的性能差距是核心驱动力。

### 2. ESM First

Vite 推动了 ESM 在开发环境的普及。浏览器原生 ESM 支持越来越成熟，打包不再是唯一选择。

### 3. 编译时优化

`<script setup>`、Svelte 的编译策略、Solid 的编译时响应性……框架越来越倾向于在编译阶段做优化，而不是运行时。

### 4. Edge Computing

Vercel Edge Functions、Cloudflare Workers、Deno Deploy……边缘计算让前端有了新的部署形态。

## 我的 2021 工具链

```
框架：    Vue 3 + <script setup>
构建：    Vite
状态：    Pinia
CSS：     Tailwind CSS 3.0
包管理：  pnpm
Monorepo：pnpm workspace + Turborepo
测试：    Vitest（实验中）+ Playwright
部署：    Vite SSR + Docker
```

## 小结

- 2021 是 Vite 之年，构建工具格局被彻底改变
- React 18 的并发特性是框架层面最重要的变化
- Rust 重写工具链是趋势，性能差距让 JavaScript 工具相形见绌
- Monorepo 工具链成熟：pnpm + Turborepo 是最优组合
- 2022 年看好：Vitest 正式发布、React 18 正式版、RSC（React Server Components）落地