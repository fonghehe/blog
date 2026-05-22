---
title: "pnpm workspace 搭建 Monorepo：實踐方法與治理思路"
date: 2021-03-08 15:28:40
tags:
  - 前端工程化
readingTime: 3
description: "用了兩年 Lerna + Yarn workspace 的組合後，今年開始嘗試 pnpm workspace。pNpm 的硬鏈接機製天然適合 Monorepo——依賴不會重複安裝，磁盤佔用大幅減少。對比下來，pnpm workspace 可能是目前最優雅的 Monorepo 方案。"
wordCount: 505
---

用了兩年 Lerna + Yarn workspace 的組合後，今年開始嘗試 pnpm workspace。pNpm 的硬鏈接機製天然適合 Monorepo——依賴不會重複安裝，磁盤佔用大幅減少。對比下來，pnpm workspace 可能是目前最優雅的 Monorepo 方案。

## 為什麼選 pnpm

pnpm 的核心優勢在 Monorepo 場景下特別明顯：

1. **硬鏈接存儲**：全局 store + 硬鏈接，10 個子項目共享同一份依賴，不會像 Yarn v1 那樣每個項目都裝一份
2. **嚴格的依賴管理**：幽靈依賴問題被徹底解決，package.json 裏沒聲明的依賴用不了
3. **原生 workspace 支援**：不需要 Lerna 這樣的上層工具，pnpm 自己就能處理

```bash
# 安裝速度對比（同一個 Monorepo，30 個子項目）
# npm:     ~120s
# yarn v1: ~85s
# pnpm:    ~15s

# 磁盤佔用對比
# npm:     ~2.1GB
# yarn v1: ~1.8GB
# pnpm:    ~600MB（硬鏈接去重）
```

## 項目結構搭建

```bash
# 初始化項目
mkdir my-monorepo && cd my-monorepo
pnpm init

# 創建目錄結構
mkdir -p packages/{shared,components,utils}
mkdir -p apps/{admin,portal}
```

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── packages/
│   ├── shared/          # 共享業務邏輯
│   │   ├── package.json
│   │   └── src/
│   ├── components/      # 組件庫
│   │   ├── package.json
│   │   └── src/
│   └── utils/           # 工具函數
│       ├── package.json
│       └── src/
├── apps/
│   ├── admin/           # 後臺管理
│   │   ├── package.json
│   │   └── src/
│   └── portal/          # 門户網站
│       ├── package.json
│       └── src/
└── tools/
    └── eslint-config/   # 共享 ESLint 配置
```

## 核心設定

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

**子包 package.json**（以 utils 為例）：

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

在 Monorepo 中，子包之間互相引用用 `workspace:` 協議：

```json
{
  "name": "@my-monorepo/components",
  "dependencies": {
    "@my-monorepo/utils": "workspace:*",
    "@my-monorepo/shared": "workspace:*"
  }
}
```

發佈時 pnpm 會自動將 `workspace:*` 替換為實際版本號。

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

`--filter` 是 pnpm workspace 最強大的功能，可以精確控製命令作用範圍：

```bash
# 隻在 admin 應用中安裝 lodash
pnpm --filter admin add lodash

# 隻在 admin 中安裝，但要先構建它依賴的包
pnpm --filter admin... build

# 在 packages/ 下的所有包中運行 test
pnpm --filter './packages/*' test

# 隻構建 utils 和依賴 utils 的包
pnpm --filter '@my-monorepo/utils...' build

# 在 admin 中運行 dev，同時 watch 它依賴的本地包
pnpm --filter admin dev

# 運行所有 packages 的 build（按拓撲排序）
pnpm -r --filter './packages/*' build
```

## Vite 構建設定

子包的 Vite 配置，輸出庫模式：

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
      external: ['dayjs'] // 不打包依賴
    }
  }
})
```

## 常見問題

**幽靈依賴問題（Phantom Dependencies）**：

```typescript
// ❌ 在 npm/yarn 的 node_modules 扁平結構中，
// 依賴的依賴可以直接 import（幽靈依賴）
import something from 'transitive-dependency'

// ✅ pnpm 的嚴格結構不允許這樣做
// 必須在 package.json 中顯式聲明
// 報錯：Module not found
```

這是 pnpm 的設計決策，強製正確的依賴聲明。

**`.npmrc` 配置**：

```ini
# 如果確實需要訪問未聲明的依賴（不推薦）
shamefully-hoist=true

# 也可以隻對特定包豁免
public-hoist-pattern[]=*eslint*
```

## 和 Lerna 的對比

| 維度 | Lerna + Yarn v1 | pnpm workspace |
|
------|----------------|----------------|
| 依賴管理 | 扁平化，有幽靈依賴 | 嚴格隔離 |
| 磁盤佔用 | 高（重複安裝） | 低（硬鏈接） |
| 安裝速度 | 慢 | 快 |
| 需要額外工具 | 需要 Lerna | 不需要 |
| 版本發佈 | Lerna publish | changesets |
| 學習曲線 | 中等 | 低 |

如果你的團隊還在用 Lerna，遷移成本不高，收益明顯。

## 小結

- pnpm workspace 是目前最輕量的 Monorepo 方案，不需要 Lerna
- `workspace:*` 協議處理子包間依賴，`--filter` 精確控製命令範圍
- 硬鏈接存儲 + 嚴格依賴管理是 pnpm 的核心優勢
- 搭配 Vite 構建子包，開發體驗很流暢
- 版本管理推薦用 changesets 替代 Lerna publish