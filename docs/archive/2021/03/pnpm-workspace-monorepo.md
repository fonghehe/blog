---
title: "pnpm workspace 搭建 Monorepo"
date: 2021-03-08 15:28:40
tags:
  - 前端工程化
readingTime: 3
description: "用了两年 Lerna + Yarn workspace 的组合后，今年开始尝试 pnpm workspace。pNpm 的硬链接机制天然适合 Monorepo——依赖不会重复安装，磁盘占用大幅减少。对比下来，pnpm workspace 可能是目前最优雅的 Monorepo 方案。"
wordCount: 505
---

用了两年 Lerna + Yarn workspace 的组合后，今年开始尝试 pnpm workspace。pNpm 的硬链接机制天然适合 Monorepo——依赖不会重复安装，磁盘占用大幅减少。对比下来，pnpm workspace 可能是目前最优雅的 Monorepo 方案。

## 为什么选 pnpm

pnpm 的核心优势在 Monorepo 场景下特别明显：

1. **硬链接存储**：全局 store + 硬链接，10 个子项目共享同一份依赖，不会像 Yarn v1 那样每个项目都装一份
2. **严格的依赖管理**：幽灵依赖问题被彻底解决，package.json 里没声明的依赖用不了
3. **原生 workspace 支持**：不需要 Lerna 这样的上层工具，pnpm 自己就能处理

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

## 项目结构搭建

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

## 核心配置

**pnpm-workspace.yaml**：

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

**根 package.json**：

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

**子包 package.json**（以 utils 为例）：

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

## 子包互相引用

在 Monorepo 中，子包之间互相引用用 `workspace:` 协议：

```json
{
  "name": "@my-monorepo/components",
  "dependencies": {
    "@my-monorepo/utils": "workspace:*",
    "@my-monorepo/shared": "workspace:*"
  }
}
```

发布时 pnpm 会自动将 `workspace:*` 替换为实际版本号。

```typescript
// packages/components/src/Button.vue
<script setup>
import { formatCurrency } from '@my-monorepo/utils'
import { useUserStore } from '@my-monorepo/shared'

const props = defineProps<{ amount: number }>()
const formatted = computed(() => formatCurrency(props.amount))
</script>
```

## pnpm --filter 命令

`--filter` 是 pnpm workspace 最强大的功能，可以精确控制命令作用范围：

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

## Vite 构建配置

子包的 Vite 配置，输出库模式：

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

## 常见问题

**幽灵依赖问题（Phantom Dependencies）**：

```typescript
// ❌ 在 npm/yarn 的 node_modules 扁平结构中，
// 依赖的依赖可以直接 import（幽灵依赖）
import something from 'transitive-dependency'

// ✅ pnpm 的严格结构不允许这样做
// 必须在 package.json 中显式声明
// 报错：Module not found
```

这是 pnpm 的设计决策，强制正确的依赖声明。

**`.npmrc` 配置**：

```ini
# 如果确实需要访问未声明的依赖（不推荐）
shamefully-hoist=true

# 也可以只对特定包豁免
public-hoist-pattern[]=*eslint*
```

## 和 Lerna 的对比

| 维度 | Lerna + Yarn v1 | pnpm workspace |
|
------|----------------|----------------|
| 依赖管理 | 扁平化，有幽灵依赖 | 严格隔离 |
| 磁盘占用 | 高（重复安装） | 低（硬链接） |
| 安装速度 | 慢 | 快 |
| 需要额外工具 | 需要 Lerna | 不需要 |
| 版本发布 | Lerna publish | changesets |
| 学习曲线 | 中等 | 低 |

如果你的团队还在用 Lerna，迁移成本不高，收益明显。

## 小结

- pnpm workspace 是目前最轻量的 Monorepo 方案，不需要 Lerna
- `workspace:*` 协议处理子包间依赖，`--filter` 精确控制命令范围
- 硬链接存储 + 严格依赖管理是 pnpm 的核心优势
- 搭配 Vite 构建子包，开发体验很流畅
- 版本管理推荐用 changesets 替代 Lerna publish