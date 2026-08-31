---
title: "Turborepo First Look: High-Performance Monorepo Builds"
date: 2021-11-08 15:28:08
tags:
  - Engineering

readingTime: 2
description: "Vercel acquired Turborepo and open-sourced it — a high-performance monorepo build tool written in Go. I tried it for a week and compared it with Lerna and pnpm workspace."
wordCount: 248
---

Vercel acquired Turborepo and open-sourced it; it's a high-performance monorepo build tool written in Go. I tried it out for a week and compared it against Lerna and pnpm workspaces.

## Pain Points of Monorepo

When managing a monorepo with pnpm workspaces, package management is fine, but the build orchestration is rather primitive:

```bash
# pnpm workspace 的构建方式
pnpm run build --filter=packages/core
pnpm run build --filter=packages/utils
pnpm run build --filter=packages/ui
pnpm run build --filter=apps/web

# 问题：
# 1. 手动排构建顺序
# 2. 没有缓存（每次全量构建）
# 3. CI 上更慢（没有本地缓存）
```

## What Turborepo Solves

- **Build caching**: identical inputs aren't rebuilt (local + remote cache)
- **Parallel scheduling**: automatically analyzes the dependency graph and builds independent packages in parallel
- **Incremental builds**: only builds changed packages and their downstream dependents

## Basic Configuration

```bash
# 安装
npm install -D turbo
```

```jsonc
// turbo.json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],       // 先构建依赖的包
      "outputs": ["dist/**"]          // 缓存这些产物
    },
    "dev": {
      "cache": false,                 // dev 不缓存（持续运行）
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

```jsonc
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "lint": "eslint src/"
  }
}

// apps/web/package.json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "lint": "eslint src/"
  }
}
```

## Running

```bash
# 构建所有包（自动分析依赖图，并行执行）
turbo run build

# 只构建某个包及其依赖
turbo run build --filter=@myorg/web

# 并行运行所有 dev
turbo run dev --parallel

# 运行所有 lint（无依赖，完全并行）
turbo run lint
```

## Caching Mechanism

```bash
# 第一次构建
turbo run build
# packages/core:   build (2.3s)
# packages/utils:  build (1.1s)
# packages/ui:     build (3.5s)
# apps/web:        build (5.2s)

# 没有任何改动，第二次构建
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)
# packages/utils:  build >>> FULL TURBO (cached, 0.0s)
# packages/ui:     build >>> FULL TURBO (cached, 0.0s)
# apps/web:        build >>> FULL TURBO (cached, 0.0s)

# 只改了 utils，第三次构建
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)    # 没变
# packages/utils:  build (1.2s)                             # 重新构建
# packages/ui:     build (3.4s)                             # 依赖 utils，重新构建
# apps/web:        build (5.1s)                             # 依赖 ui，重新构建
```

The cache key is based on: source file contents + environment variables + the lock file + package.json scripts.

## Remote Caching (CI Scenarios)

```bash
# 登录 Vercel（免费提供远程缓存）
npx turbo login

# 链接远程缓存
npx turbo link

# 之后 turbo run build 自动同步缓存到 Vercel
# 本地构建一次 → CI 直接用缓存
```

Example CI configuration:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 6
      - uses: actions/setup-node@v3
        with:
          node-version: 16
          cache: 'pnpm'

      - run: pnpm install

      # Turborepo 自动使用远程缓存
      # 如果本地已经构建过，CI 直接用缓存
      - run: pnpm turbo run build test lint
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## Comparison with Lerna

| Feature | Lerna | Turborepo |
|---------|-------|-----------|
| Build orchestration | Relies on topological sort | Automatic dependency graph + parallelism |
| Caching | None | Local + remote |
| Incremental builds | None | Automatic |
| Package publishing | Yes (core feature) | No (doesn't handle publishing) |
| Config complexity | Moderate | Minimal |

Lerna handles publishing, Turborepo handles builds; the two can be used together.

## Working with pnpm Workspace

```bash
# pnpm 管依赖，Turborepo 管构建编排
# 这是目前最推荐的组合

# package.json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.0.0",
    "pnpm": "7.x"  // pnpm 用 workspace 协议管理依赖
  }
}
```

## Summary

- Turborepo solves the build orchestration and caching problems of monorepos, but not package publishing
- Local + remote caching is its biggest selling point; CI build times can drop from minutes to seconds
- Pairing it with pnpm workspaces is the optimal setup: pnpm manages dependencies, Turborepo manages builds
- Configuration is minimal (a single turbo.json), so the learning curve is low
- It suits monorepos with 3+ packages; for fewer packages, pnpm workspaces alone are enough
