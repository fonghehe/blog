---
title: "Building a Monorepo with pnpm Workspace"
date: 2021-03-08 15:28:40
tags:
  - Engineering

readingTime: 3
description: "After two years on Lerna plus Yarn workspaces, I switched to pnpm workspace this year. pnpm's hard-link mechanism is a natural fit for monorepos — dependencies aren't installed twice and disk usage drops dramatically. All things considered, pnpm workspace may be the most elegant monorepo solution available today."
wordCount: 336
---

After two years of using the Lerna + Yarn workspace combination, I started trying pnpm workspace this year. pnpm's hard-link mechanism is a natural fit for monorepos—dependencies aren't installed repeatedly, so disk usage drops dramatically. All things considered, pnpm workspace is probably the most elegant monorepo solution available today.

## Why Choose pnpm

pnpm's core advantages are especially clear in a monorepo setup:

1. **Hard-linked storage**: a global store plus hard links means ten subprojects share one copy of a dependency, instead of each project installing its own as in Yarn v1
2. **Strict dependency management**: the phantom-dependency problem is eliminated—any dependency not declared in package.json simply can't be imported
3. **Native workspace support**: no top-level tool like Lerna is needed; pnpm handles it on its own

```bash
# 安装速度对比（同一个 Monorepo，30 个子项目）
# npm:     ~120s
# yarn v1: ~85s
# pnpm:    ~15s

# 磁盘占用对比
# npm:     ~2.1GB
# yarn v1: ~1.8GB
# pnpm:    ~600MB（硬链接去重）
```

## Project Structure Setup

```bash
# 初始化项目
mkdir my-monorepo && cd my-monorepo
pnpm init

# 创建目录结构
mkdir -p packages/{shared,components,utils}
mkdir -p apps/{admin,portal}
```

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── packages/
│   ├── shared/          # 共享业务逻辑
│   │   ├── package.json
│   │   └── src/
│   ├── components/      # 组件库
│   │   ├── package.json
│   │   └── src/
│   └── utils/           # 工具函数
│       ├── package.json
│       └── src/
├── apps/
│   ├── admin/           # 后台管理
│   │   ├── package.json
│   │   └── src/
│   └── portal/          # 门户网站
│       ├── package.json
│       └── src/
└── tools/
    └── eslint-config/   # 共享 ESLint 配置
```

## Core Configuration

**pnpm-workspace.yaml**:

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

**Root `package.json`**:

```json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter admin dev",
    "dev:portal": "pnpm --filter portal dev",
    "build": "pnpm -r --filter './packages/*' build",
    "build:all": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^4.3.0",
    "vite": "^2.5.0",
    "@vitejs/plugin-vue": "^1.6.0"
  }
}
```

**Sub-package `package.json`** (using `utils` as an example):

```json
{
  "name": "@my-monorepo/utils",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "dependencies": {
    "dayjs": "^1.10.0"
  }
}
```

## Cross-Package References

In a monorepo, sub-packages reference each other using the `workspace:` protocol:

```json
{
  "name": "@my-monorepo/components",
  "dependencies": {
    "@my-monorepo/utils": "workspace:*",
    "@my-monorepo/shared": "workspace:*"
  }
}
```

At publish time, pnpm automatically replaces `workspace:*` with the actual version number.

```typescript
// packages/components/src/Button.vue
<script setup>
import { formatCurrency } from '@my-monorepo/utils'
import { useUserStore } from '@my-monorepo/shared'

const props = defineProps<{ amount: number }>()
const formatted = computed(() => formatCurrency(props.amount))
</script>
```

## The pnpm --filter Command

`--filter` is the most powerful feature of pnpm workspace; it precisely controls the scope of a command:

```bash
# 只在 admin 应用中安装 lodash
pnpm --filter admin add lodash

# 只在 admin 中安装，但要先构建它依赖的包
pnpm --filter admin... build

# 在 packages/ 下的所有包中运行 test
pnpm --filter './packages/*' test

# 只构建 utils 和依赖 utils 的包
pnpm --filter '@my-monorepo/utils...' build

# 在 admin 中运行 dev，同时 watch 它依赖的本地包
pnpm --filter admin dev

# 运行所有 packages 的 build（按拓扑排序）
pnpm -r --filter './packages/*' build
```

## Vite Build Configuration

A sub-package's Vite config, set to library mode:

```typescript
// packages/utils/vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyUtils',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: ['dayjs'] // 不打包依赖
    }
  }
})
```

## Common Issues

**Phantom dependency issue (Phantom Dependencies):**

```typescript
// ❌ 在 npm/yarn 的 node_modules 扁平结构中，
// 依赖的依赖可以直接 import（幽灵依赖）
import something from 'transitive-dependency'

// ✅ pnpm 的严格结构不允许这样做
// 必须在 package.json 中显式声明
// 报错：Module not found
```

This is a deliberate design decision in pnpm that enforces correct dependency declarations.

**.npmrc config:**

```ini
# 如果确实需要访问未声明的依赖（不推荐）
shamefully-hoist=true

# 也可以只对特定包豁免
public-hoist-pattern[]=*eslint*
```

## Comparison with Lerna

| Dimension | Lerna + Yarn v1 | pnpm workspace |
|----------|-----------------|----------------|
| Dependency management | Flat, with phantom dependencies | Strict isolation |
| Disk usage | High (duplicate installs) | Low (hard links) |
| Install speed | Slow | Fast |
| Extra tooling required | Lerna | None |
| Publishing | Lerna publish | changesets |
| Learning curve | Moderate | Low |

If your team is still on Lerna, the migration cost is low and the benefits are clear.

## Summary

- pnpm workspace is the lightest-weight monorepo solution today and needs no Lerna
- The `workspace:*` protocol handles inter-package dependencies, and `--filter` precisely scopes commands
- Hard-linked storage plus strict dependency management are pnpm's core advantages
- Pairing it with Vite to build sub-packages makes for a smooth development experience
- For version management, changesets is recommended over Lerna publish