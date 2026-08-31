---
title: "Turborepo: The Perfect Partner for Monorepo Build Orchestration"
date: 2022-03-08 10:39:07
tags:
  - Frontend
readingTime: 2
description: "The last post covered pnpm workspace for dependency management. This one is about build orchestration — when your monorepo has a dozen packages to build and test, how do you run them in dependency order while maximizing parallelism?"
wordCount: 304
---

The last post covered pnpm workspace for dependency management. This one is about build orchestration — when your monorepo has a dozen packages to build and test, how do you run them in dependency order while maximizing parallelism?

Turborepo is the answer. It's a build orchestration tool that doesn't replace pnpm but works alongside it.

## Installation and Setup

```bash
# 在已有的 pnpm workspace 项目中
pnpm add -D -w turbo
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Key configuration explained:

- `dependsOn: ["^build"]`: means the current package's build depends on the builds of all its workspace dependencies (`^` indicates upstream dependencies)
- `dependsOn: ["build"]`: means test depends on the current package's own build
- `outputs`: build output paths, used by Turborepo for caching
- `cache: false`: dev is not cached
- `persistent: true`: dev is a long-running process

## Running Commands

```bash
# 构建所有包（按拓扑排序 + 并行）
turbo run build

# 只构建有变更的包
turbo run build --filter=...[HEAD]

# 构建 admin 及其所有依赖
turbo run build --filter=admin...

# 测试所有包
turbo run test

# 并行执行多个任务
turbo run build test lint

# 开发模式（所有包同时启动）
turbo run dev --parallel
```

## Remote Caching

Turborepo's most attractive feature — CI and local environments share the build cache:

```bash
# 登录 Vercel（Turborepo 官方托管）
npx turbo login

# 链接远程缓存
npx turbo link
```

You can also self-host the remote cache:

```json
// turbo.json
{
  "remoteCache": {
    "apiUrl": "https://your-cache-server.com",
    "token": "your-token"
  }
}
```

```bash
# CI 中使用（GitHub Actions）
- name: Build
  run: turbo run build test
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

The result: after the first CI build, subsequent PRs that don't change build source code hit the cache directly, dropping build time from 3 minutes to 5 seconds.

## Real-World Project Configuration

Our monorepo structure:

```
frontend-monorepo/
├── packages/
│   ├── ui-components/     # 构建产物 dist/
│   ├── utils/             # 构建产物 dist/
│   ├── eslint-config/     # 无构建，只有 lint
│   └── ts-config/         # 无构建
├── apps/
│   ├── admin/             # 构建产物 dist/
│   ├── h5/                # 构建产物 dist/
│   └── docs/              # 构建产物 dist/
└── turbo.json
```

对应的 turbo.json：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env*", "tsconfig.base.json"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".output/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**", "vitest.config.*"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", "*.config.*", ".eslintrc*"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "storybook": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`globalDependencies` defines files that affect all packages — when any of these change, all caches are invalidated.

## Advanced Filter Usage

```bash
# 构建所有 apps 目录下的包
turbo run build --filter='./apps/*'

# 构建 ui-components 及其所有消费方
turbo run build --filter='...ui-components'

# 排除 docs 包
turbo run build --filter='!docs'

# 组合：构建受当前 git diff 影响的包
turbo run build --filter='...[HEAD^]'
```

## GitHub Actions 集成

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # 需要完整历史来判断变更

      - uses: pnpm/action-setup@v2
        with:
          version: 7

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Build & Test
        run: turbo run build test lint
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

## Division of Labor: pnpm + Turborepo

| Capability | pnpm workspace | Turborepo |
|------|---------------|-----------|
| Dependency management | Handles it | Not its job |
| Workspace protocol | Handles it | Not its job |
| Build orchestration | Basic (-r) | Handles it |
| Parallel execution | Basic | Smart parallelism |
| Build caching | None | Local + remote |
| Task pipeline | None | Full support |

In short: pnpm manages dependencies, Turborepo manages builds.

## Summary

Turborepo is a lightweight solution for monorepo build orchestration. It doesn't do package management (that's pnpm's job) — it focuses solely on task orchestration and caching. For small-to-medium monorepos, the pnpm + Turborepo combination is already excellent. If you need heavier features (versioning, changelog generation), add Changesets on top.