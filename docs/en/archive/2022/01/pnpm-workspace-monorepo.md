---
title: "pnpm Workspace: A Monorepo Solution That Escapes node_modules Hell"
date: 2022-01-10 11:13:23
tags:
  - Frontend Engineering
readingTime: 2
description: "The team has been migrating multiple frontend projects to pnpm workspace for half a year. Disk usage dropped by 60%, installation speed improved noticeably, and"
wordCount: 274
---

The team has been migrating multiple frontend projects to pnpm workspace for half a year. Disk usage dropped by 60%, installation speed improved noticeably, and the phantom dependency problem was completely resolved. This article documents our migration process.

## Why Choose pnpm

npm and yarn use a flat node_modules structure, and dependency hoisting brings two problems:

1. **Phantom dependencies**: You can import packages not declared in your package.json (because they were hoisted to the top level)
2. **Disk waste**: Different projects each maintain a complete copy of node_modules

pnpm solves both problems using hard links and content-addressable storage:

```bash
# 全局安装 pnpm
npm install -g pnpm@7

# 查看全局存储
pnpm store path
# ~/.local/share/pnpm/store/v3
```

## Project Structure

Here is the structure of our frontend monorepo:

```
frontend-monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── ui-components/        # 组件库
│   ├── utils/                # 工具函数
│   ├── eslint-config/        # ESLint 共享配置
│   └── ts-config/            # TypeScript 共享配置
├── apps/
│   ├── admin/                # 后台管理
│   ├── h5/                   # 移动端 H5
│   └── docs/                 # 文档站
└── pnpm-lock.yaml
```

## pnpm-workspace.yaml Configuration

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

The root `package.json`:

```json
{
  "name": "frontend-monorepo",
  "private": true,
  "scripts": {
    "dev:admin": "pnpm --filter admin dev",
    "dev:h5": "pnpm --filter h5 dev",
    "build:all": "pnpm -r build",
    "test:all": "pnpm -r test",
    "lint:all": "pnpm -r lint"
  },
  "engines": {
    "node": ">=16"
  }
}
```

## Workspace Dependency Management

```bash
# 给 admin 项目安装 ui-components（workspace 协议）
pnpm --filter admin add ui-components@workspace:*

# 给 admin 安装 lodash（只装在 admin）
pnpm --filter admin add lodash

# 给所有项目安装 typescript（作为 devDependencies）
pnpm -r add -D typescript

# 给根目录安装全局开发工具
pnpm add -D -w husky lint-staged
```

After installation, the dependencies in `admin/package.json` will look like this:

```json
{
  "dependencies": {
    "ui-components": "workspace:*",
    "lodash": "^4.17.21"
  }
}
```

`workspace:*` means the local version is always used; when publishing, pnpm automatically replaces it with the real version number.

## .npmrc Configuration

```ini
# 使用严格模式，不能访问未声明的依赖
strict-peer-dependencies=false

# 在项目级别创建 node_modules，保持兼容性
node-linker=hoisted

# 使用公共的 lockfile
shared-workspace-lockfile=true

# 自动安装 peerDependencies
auto-install-peers=false
```

`node-linker` has three options:
- `isolated` (default): a strict symlink structure—worst compatibility but most secure
- `hoisted`: a flat structure like npm/yarn—best compatibility
- `hoisted`: a middle-ground option

We chose `hoisted` because some legacy dependencies don't support the strict node_modules structure.

## Getting the Most Out of Filters

```bash
# 只执行 admin 及其依赖的 build
pnpm --filter admin... build

# 执行 ui-components 被依赖的所有项目
pnpm --filter '...ui-components' build

# 结合使用：build 受影响的项目
pnpm --filter '...ui-components' --filter 'admin...' build

# 排除某些包
pnpm -r --no-filter docs test
```

This is especially useful in CI—it builds and tests only the projects that changed.

## Common Pitfalls

### 1. peerDependencies Warnings

```json
// packages/ui-components/package.json
{
  "peerDependencies": {
    "react": ">=17",
    "react-dom": ">=17"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false },
    "react-dom": { "optional": false }
  }
}
```

pnpm is strict about peerDependencies, so every consumer must install react explicitly.

### 2. Workspace Protocol Version Ranges

```json
"ui-components": "workspace:^"   // 发布时替换为 ^1.2.3
"ui-components": "workspace:*"   // 发布时替换为 1.2.3（精确版本）
"ui-components": "workspace:~"   // 发布时替换为 ~1.2.3
```

### 3. Script Execution Order

```bash
# 按拓扑排序执行（先执行依赖，再执行消费方）
pnpm -r --workspace-concurrency=1 build

# 并行执行（更快但要确保 build 之间没有依赖）
pnpm -r build
```

## Migration Steps Summary

```bash
# 1. 全局安装 pnpm
npm install -g pnpm@7

# 2. 删除旧的 lock 文件和 node_modules
rm -rf node_modules package-lock.json yarn.lock

# 3. 初始化 workspace
echo "packages:
  - 'packages/*'
  - 'apps/*'" > pnpm-workspace.yaml

# 4. 安装依赖
pnpm install

# 5. 用 pnpm filter 替换原来的脚本
```

## Summary

pnpm workspace strikes the best balance between disk efficiency and dependency isolation. For frontend monorepos, it is currently the most pragmatic choice. Next, I'll write about Turborepo for build orchestration, combining it with pnpm to form a complete monorepo toolchain.