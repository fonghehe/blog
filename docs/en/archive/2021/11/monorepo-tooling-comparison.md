---
title: "Turborepo First Look: High-Performance Monorepo Builds"
date: 2021-11-08 15:28:08
tags:
  - Engineering

readingTime: 2
description: "Vercel 收购了 Turborepo 并开源，这是一个用 Go 写的高性能 Monorepo 构建工具。试用了一周，和 Lerna / pnpm workspace 对比了一下。"
wordCount: 353
---

Vercel 收购了 Turborepo 并开源，这是一个用 Go 写的高性能 Monorepo 构建工具。试用了一周，和 Lerna / pnpm workspace 对比了一下。

## Pain Points of Monorepo

用 pnpm workspace 管理 monorepo 项目，包管理没问题，但构建编排很原始：

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

- **构建缓存**：相同输入不重复构建（本地 + 远程缓存）
- **并行调度**：自动分析依赖图，并行构建无依赖的包
- **增量构建**：只构建有变化的包及其下游依赖

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

缓存 key 基于：源文件内容 + 环境变量 + lock 文件 + package.json scripts。

## Remote Caching (CI Scenarios)

```bash
# 登录 Vercel（免费提供远程缓存）
npx turbo login

# 链接远程缓存
npx turbo link

# 之后 turbo run build 自动同步缓存到 Vercel
# 本地构建一次 → CI 直接用缓存
```

CI 配置示例：

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

| 特性 | Lerna | Turborepo |
|------|-------|-----------|
| 构建编排 | 依赖 topo 排序 | 自动依赖图 + 并行 |
| 缓存 | 无 | 本地 + 远程 |
| 增量构建 | 无 | 自动 |
| 包发布 | 有（核心功能） | 无（不管发布） |
| 配置复杂度 | 中等 | 极简 |

Lerna 管发布，Turborepo 管构建，可以一起用。

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

- Turborepo 解决 Monorepo 的构建编排和缓存问题，不解决包发布问题
- 本地 + 远程缓存是最大卖点，CI 构建时间可以从分钟级降到秒级
- 和 pnpm workspace 配合是最优方案：pnpm 管依赖，Turborepo 管构建
- 配置极简（一个 turbo.json），学习成本低
- 适合有 3+ 包的 Monorepo 项目；包少的话 pnpm workspace 够用