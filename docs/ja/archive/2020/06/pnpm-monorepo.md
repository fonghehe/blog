---
title: "pnpm workspace を使ったMonorepo管理"
date: 2020-06-23 15:01:17
tags:
  - Node.js
readingTime: 2
description: "团队有 5 个前端项目，共用一套组件库和工具函数。之前组件库改动需要手动发布、各项目手动升级，效率太低。用 pnpm workspace 搭建 Monorepo 后，一切都变简单了。"
---

团队有 5 个前端项目，共用一套组件库和工具函数。之前组件库改动需要手动发布、各项目手动升级，效率太低。用 pnpm workspace 搭建 Monorepo 后，一切都变简单了。

## なぜpnpmを選ぶのか

```markdown
npm/yarn 的问题：
- node_modules 幽灵依赖（没声明的包也能访问）
- 磁盘占用大（每个项目都拷贝一份）
- 扁平化安装导致的版本冲突

pnpm 的优势：
- 严格依赖：只能访问 package.json 声明的依赖
- 硬链接 + 符号链接：磁盘占用大幅减少
- 内置 workspace 支持：Monorepo 不需要 lerna
```

```bash
# 安装 pnpm
npm install -g pnpm

# 验证
pnpm --version
```

## プロジェクト構造

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

## 配置文件

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

## 包之间互相引用

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

## 常用命令

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

## 和 lerna 对比

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

## 选择性构建

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

## まとめ

- pnpm workspace 是管理 Monorepo 最轻量的选择，不需要额外工具
- `workspace:*` 声明内部依赖，修改立刻生效
- 严格依赖管理杜绝幽灵依赖问题
- 硬链接节省磁盘空间，安装速度也更快
- 配合 changeset 管理版本和发布，流程自动化
