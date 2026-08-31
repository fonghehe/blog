---
title: "2021 Frontend Ecosystem Review: The Year of Vite"
date: 2021-12-13 16:06:07
tags:
  - Frontend
  - Engineering
  - Vite

readingTime: 3
description: "2021 is almost over — here's a roundup of the important changes in the frontend ecosystem this year. If I had to summarize 2021's frontend in one word, I'd pick 'Vite'."
wordCount: 648
---

2021 is nearly over, so it's a good time to recap the major shifts in the frontend ecosystem. If I had to sum up frontend in 2021 in a single word, it would be "Vite".

## Build Tools: Vite Becomes the De Facto Standard

At the start of 2021, Vite 2.0 shipped; by year's end it had become the default choice for Vue 3 and a growing number of React projects.

**Key milestones:**
- February: Vite 2.0 officially released, adopting an ESM + esbuild pre-bundling architecture
- June: SvelteKit adopts Vite by default
- September: The Vite team publishes the Vitest design proposal
- December: The Vite ecosystem surpasses 300 plugins

Vite reshaped how the frontend world thinks about the "dev server": you can develop without bundling, and on-demand compilation is the right approach.

```bash
# Webpack 时代的启动
npm run dev    # 等待 30s...

# Vite 时代的启动
npm run dev    # < 1s
```

Webpack 5 also brought several optimizations this year (persistent caching, Module Federation), but the gap in developer experience has already widened.

## Framework Landscape

### The Vue Ecosystem

- **Vue 3.2**: `<script setup>` marked stable; compile-time macros became the recommended style
- **Pinia**: became the recommended state-management solution for Vue; Vuex 5 will be redesigned on top of Pinia
- **VitePress**: a docs-site generator, replacing VuePress
- **Nuxt 3**: released its RC in October, built on the Vite + Nitro server engine

### The React Ecosystem

- **React 18**: Alpha → Beta, reaching RC by year's end
- **Concurrent features**: `useTransition`, `useDeferredValue`, Automatic Batching
- **Suspense SSR**: streaming rendering + selective hydration
- **Next.js 12**: Rust-based compiler (SWC), Middleware, React 18 support
- **Remix**: open-sourced in November, challenging Next.js

### Emerging Frameworks

- **Solid.js**: React-like syntax, no virtual DOM, excellent performance
- **Qwik**: introduces the concept of Resumability, delivering interactivity with 0 KB of JS
- **Astro**: islands architecture with partial hydration

## CSS Changes

- **Tailwind CSS 3.0**: JIT became the default mode, with arbitrary value support
- **CSS Container Queries**: experimental support in Chrome Canary
- **Lightning CSS**: a Rust-based CSS toolchain (used by Parcel 2)
- **UnoCSS**: an atomic CSS engine released by Anthony Fu, outperforming Windi CSS

## TypeScript

- **TypeScript 4.4**: improved control-flow analysis, `exactOptionalPropertyTypes`
- **TypeScript 4.5**: the `Awaited` type, `type`-only modifier imports
- The type-gymnastics community stayed active, with libraries like `type-fest` and `ts-toolbelt`

## Toolchain

### Package Management

- **pnpm**: the fastest-growing package manager of 2021, saving disk space plus strict dependency isolation
- **Corepack**: a package-manager manager built into Node.js

### Monorepo

- **Turborepo**: open-sourced in December after Vercel acquired it; a high-performance build orchestrator written in Go
- **Nx**: continued iterating; version 12.9 added a Vite executor
- **pnpm workspace**: became the lightest-weight Monorepo solution

### Testing

- **Vitest**: the concept formed and a beta shipped by year's end — a Vite-based unit-testing framework
- **Playwright**: the new favorite for E2E testing, from Microsoft, with solid cross-browser support
- **Testing Library**: became the mainstream choice for React component testing

## Runtime

- **Deno 1.15**: improved compatibility and a better npm-compatibility layer
- **Bun**: Jarred Sumner began writing a new JS runtime in Zig (teased at year's end)
- **Node.js 16 LTS**: became an LTS release in October

## Trends Worth Watching

### 1. Rust Rewrites the Frontend Toolchain

esbuild, SWC, Rome, Lightning CSS... the trend of rewriting the JavaScript toolchain in Rust or Go is irreversible. A 10x-plus performance gap is the core driver.

### 2. ESM First

Vite drove the adoption of ESM in development. Native browser ESM support is maturing, and bundling is no longer the only option.

### 3. Compile-Time Optimization

`<script setup>`, Svelte's compilation strategy, Solid's compile-time reactivity... frameworks increasingly prefer to optimize at compile time rather than at runtime.

### 4. Edge Computing

Vercel Edge Functions, Cloudflare Workers, Deno Deploy... edge computing has given the frontend new deployment shapes.

## My 2021 Toolchain

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

## Summary

- 2021 was the year of Vite; the build-tool landscape was fundamentally changed
- React 18's concurrent features were the most important framework-level change
- Rust rewrites of the toolchain are a trend, and the performance gap puts JavaScript tools to shame
- The Monorepo toolchain matured: pnpm + Turborepo is the optimal combination
- On my radar for 2022: Vitest's official release, React 18 stable, and RSC (React Server Components) landing
