---
title: "Turborepo: The Task Orchestration Engine for Frontend Monorepos"
date: 2023-11-25 14:31:00
tags:
  - Frontend Engineering
readingTime: 2
description: "Turborepo has matured. After using it in our 15-package monorepo for over half a year, here are our practical insights."
wordCount: 258
---

Turborepo has matured. After using it in our 15-package monorepo for over half a year, here are our practical insights.

## Why Turborepo

Monorepo tool selection:

- **Nx**: Most feature-complete, but steep learning curve and a preference for non-JS projects
- **Lerna**: Primarily for version management, weak task orchestration
- **Turborepo**: Focused on task orchestration and caching, easy to get started, works well with pnpm

Our needs are simple: task orchestration + caching + parallel execution. We don't need all of Nx's features.

## Basic Configuration

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]
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

- `dependsOn: ["^build"]`: Build all dependency packages first (`^` denotes dependencies)
- `outputs`: Define the cached output files
- `inputs`: Define input files that affect the cache (precise control over cache invalidation)
- `cache: false`: No caching in dev mode

## How It Works

```
turbo build

1. 解析所有包的 package.json，构建依赖图
2. 按拓扑排序确定构建顺序
3. 并行执行没有依赖关系的任务
4. 每个任务的输入（源码 + 依赖 hash + 环境变量）生成 hash
5. 如果 hash 命中远程缓存，跳过执行，直接恢复 outputs
6. 执行结果上传到远程缓存
```

## Real-World Results

```
# 首次构建（无缓存）
turbo build:  45s

# 只改了一个包的代码
turbo build:  3s  （其余 14 个包命中缓存）

# CI 中 PR 重复构建
turbo build:  <1s （全部命中远程缓存）
```

## Remote Caching

```bash
# 使用 Vercel Remote Cache（免费额度够用）
npx turbo login
npx turbo link

# 或者自建远程缓存
# 使用 turbo-server 或第三方方案
```

Remote caching allows CI and local machines to share build caches. Code already built by a colleague can be used directly from the cache when you pull it.

## Working with pnpm Workspace

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// package.json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm handles dependency resolution and installation; Turbo handles task execution and caching. Clear separation of responsibilities.

## Filtering and Selective Execution

```bash
# 只构建某个包及其依赖
turbo run build --filter=@company/ui

# 只构建有变更的包
turbo run build --filter=[HEAD^1]

# 排除某些包
turbo run build --filter='!@company/docs'

# 只构建 apps 目录下的包
turbo run build --filter='./apps/*'
```

## Global Dependencies and Cache Invalidation

```jsonc
// turbo.json
{
  "globalDependencies": [
    // 这些文件变化会导致所有任务缓存失效
    ".env",
    "tsconfig.base.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      // 精确到每个任务的输入文件
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    }
  }
}
```

`globalDependencies` is important. If you forget to configure `tsconfig.base.json`, changing the base config without cache invalidation will cause mysterious build issues.

## Summary

- Turborepo focuses on one thing: task orchestration + caching, and does it well
- Natural fit with pnpm workspace, each doing its own job
- Remote caching is a killer feature; CI build times can be reduced to seconds
- Simple configuration, one `turbo.json` file does it all
- No Nx-level learning investment needed, suitable for most frontend monorepos