---
title: "Turborepo：Monorepo 构建编排的最佳拍档"
date: 2022-03-08 10:39:07
tags:
  - 前端
---

上一篇写了 pnpm workspace 做依赖管理。这篇讲构建编排——当你的 monorepo 有十几个包需要构建和测试，怎么让它们按依赖顺序执行，并且尽可能并行？

Turborepo 是答案。它是一个构建编排工具，不替代 pnpm，而是和 pnpm 配合。

## 安装与初始化

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

关键配置解释：

- `dependsOn: ["^build"]`：表示当前包的 build 依赖其所有 workspace 依赖的 build（`^` 表示依赖）
- `dependsOn: ["build"]`：表示 test 依赖当前包自己的 build
- `outputs`：构建产物路径，Turborepo 用来做缓存
- `cache: false`：dev 不缓存
- `persistent: true`：dev 是长驻进程

## 执行命令

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

## 远程缓存

Turborepo 最有吸引力的特性——CI 和本地共享构建缓存：

```bash
# 登录 Vercel（Turborepo 官方托管）
npx turbo login

# 链接远程缓存
npx turbo link
```

也可以自建远程缓存：

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

效果：第一次 CI 构建后，后续的 PR 如果没改构建源码，直接命中缓存，构建从 3 分钟降到 5 秒。

## 实际项目配置

我们的 monorepo 结构：

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

`globalDependencies` 定义了影响所有包的文件——这些文件变了，所有缓存都会失效。

## 过滤器的高级用法

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

## pnpm + Turborepo 的分工

| 能力 | pnpm workspace | Turborepo |
|------|---------------|-----------|
| 依赖管理 | 负责 | 不管 |
| workspace 协议 | 负责 | 不管 |
| 构建编排 | 基础（-r） | 负责 |
| 并行执行 | 基础 | 智能并行 |
| 构建缓存 | 没有 | 本地 + 远程 |
| 任务管道 | 没有 | 完整支持 |

简单说：pnpm 管依赖，Turborepo 管构建。

## 小结

Turborepo 是 monorepo 构建编排的轻量级方案。它不做包管理（pnpm 做），只专注于任务编排和缓存。对于中小型 monorepo，pnpm + Turborepo 的组合已经足够好。如果需要更重的功能（版本管理、changelog 生成），可以再加 Changesets。