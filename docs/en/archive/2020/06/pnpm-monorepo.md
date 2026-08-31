---
title: "pnpm Workspace for Monorepo Management"
date: 2020-06-23 15:01:17
tags:
  - Node.js
readingTime: 2
description: "How we set up a pnpm workspace monorepo to share a component library across five frontend projects, eliminating manual publishing and version-sync headaches."
wordCount: 115
---

Our team runs five frontend projects that share a common component library and utility functions. Before, any change to the component library meant manually publishing it and upgrading it in every project—far too inefficient. After setting up a pnpm workspace monorepo, everything became much simpler.

## Why Choose pnpm

```markdown
Problems with npm/yarn:
- Phantom dependencies in node_modules (you can import packages that were never declared)
- Heavy disk usage (every project keeps its own copy)
- Version conflicts caused by flat installation

Advantages of pnpm:
- Strict dependencies: you can only access what's declared in package.json
- Hard links + symlinks: disk usage drops dramatically
- Built-in workspace support: a monorepo needs no Lerna
```

```bash
# 安装 pnpm
npm install -g pnpm

# 验证
pnpm --version
```

## Project Structure

```
monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── components/        # 组件库
│   │   ├── package.json   # @company/components
│   │   └── src/
│   ├── utils/             # 工具函数库
│   │   ├── package.json   # @company/utils
│   │   └── src/
│   └── types/             # 类型定义
│       ├── package.json   # @company/types
│       └── src/
├── apps/
│   ├── admin/             # 管理后台
│   │   ├── package.json
│   │   └── src/
│   └── portal/            # 门户
│       ├── package.json
│       └── src/
```

## Configuration Files

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

```json
// 根 package.json
{
  "name": "monorepo",
  "private": true,
  "scripts": {
    "dev:admin": "pnpm --filter @company/admin dev",
    "dev:portal": "pnpm --filter @company/portal dev",
    "build:all": "pnpm -r run build",
    "test:all": "pnpm -r run test",
    "lint:all": "pnpm -r run lint"
  }
}
```

```json
// packages/utils/package.json
{
  "name": "@company/utils",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "rollup -c"
  }
}
```

## Cross-Package References

```json
// apps/admin/package.json
{
  "name": "@company/admin",
  "dependencies": {
    "@company/components": "workspace:*",
    "@company/utils": "workspace:*"
  }
}
```

```typescript
// apps/admin/src/App.vue
// 直接 import，pnpm 会自动处理链接
import { Button, Input } from '@company/components';
import { formatCurrency } from '@company/utils';

// 修改 packages/components 后，admin 里立刻生效
// 不需要手动发布和升级
```

## Common Commands

```bash
# 安装所有依赖
pnpm install

# 在指定包中执行命令
pnpm --filter @company/admin run dev

# 在所有包中执行命令
pnpm -r run build

# 只在有 changes 的包中执行
pnpm -r --changed run build

# 添加依赖到指定包
pnpm --filter @company/admin add axios

# 添加内部包依赖
pnpm --filter @company/admin add @company/utils@workspace:*

# 添加开发依赖
pnpm --filter @company/admin add -D typescript
```

## Comparison with Lerna

```bash
# lerna + yarn 需要：
# 1. lerna.json
# 2. yarn workspaces 配置
# 3. lerna bootstrap
# 4. lerna publish

# pnpm workspace：
# 1. pnpm-workspace.yaml
# 2. pnpm install
# 3. 发布可以用 pnpm publish 或 changeset
```

```bash
# 用 changeset 管理版本和发包
pnpm add -Dw @changesets/cli

# 初始化
pnpm changeset init

# 记录变更
pnpm changeset

# 升级版本
pnpm changeset version

# 发布
pnpm changeset publish
```

## Selective Builds

```json
// 根 package.json
{
  "scripts": {
    "build:changed": "pnpm -r --changed run build",
    "build:components": "pnpm --filter @company/components run build",
    "build:utils": "pnpm --filter @company/utils run build"
  }
}
```

```yaml
# .github/workflows/ci.yml
# CI 中只构建变更的包
- name: Build changed packages
  run: pnpm -r --changed run build
```

## Summary

- pnpm workspace is the lightest-weight option for managing a monorepo—no extra tooling needed.
- Declaring internal dependencies with `workspace:*` makes changes take effect immediately.
- Strict dependency management eliminates the phantom-dependency problem.
- Hard links save disk space, and installs are faster too.
- Pair it with changeset to manage versions and publishing, automating the whole flow.
