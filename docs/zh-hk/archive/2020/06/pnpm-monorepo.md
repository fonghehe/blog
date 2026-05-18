---
title: "pnpm workspace 管理 Monorepo"
date: 2020-06-23 15:01:17
tags:
  - Node.js
readingTime: 2
description: "團隊有 5 個前端項目，共用一套組件庫和工具函數。之前組件庫改動需要手動發佈、各項目手動升級，效率太低。用 pnpm workspace 搭建 Monorepo 後，一切都變簡單了。"
---

團隊有 5 個前端項目，共用一套組件庫和工具函數。之前組件庫改動需要手動發佈、各項目手動升級，效率太低。用 pnpm workspace 搭建 Monorepo 後，一切都變簡單了。

## 為什麼選 pnpm

```markdown
npm/yarn 的問題：
- node_modules 幽靈依賴（沒聲明的包也能訪問）
- 磁盤佔用大（每個項目都拷貝一份）
- 扁平化安裝導致的版本衝突

pnpm 的優勢：
- 嚴格依賴：只能訪問 package.json 聲明的依賴
- 硬鏈接 + 符號鏈接：磁盤佔用大幅減少
- 內置 workspace 支持：Monorepo 不需要 lerna
```

```bash
# 安裝 pnpm
npm install -g pnpm

# 驗證
pnpm --version
```

## 項目結構

```
monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── components/        # 組件庫
│   │   ├── package.json   # @company/components
│   │   └── src/
│   ├── utils/             # 工具函數庫
│   │   ├── package.json   # @company/utils
│   │   └── src/
│   └── types/             # 類型定義
│       ├── package.json   # @company/types
│       └── src/
├── apps/
│   ├── admin/             # 管理後台
│   │   ├── package.json
│   │   └── src/
│   └── portal/            # 門户
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

## 包之間互相引用

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
// 直接 import，pnpm 會自動處理鏈接
import { Button, Input } from '@company/components';
import { formatCurrency } from '@company/utils';

// 修改 packages/components 後，admin 裏立刻生效
// 不需要手動發佈和升級
```

## 常用命令

```bash
# 安裝所有依賴
pnpm install

# 在指定包中執行命令
pnpm --filter @company/admin run dev

# 在所有包中執行命令
pnpm -r run build

# 只在有 changes 的包中執行
pnpm -r --changed run build

# 添加依賴到指定包
pnpm --filter @company/admin add axios

# 添加內部包依賴
pnpm --filter @company/admin add @company/utils@workspace:*

# 添加開發依賴
pnpm --filter @company/admin add -D typescript
```

## 和 lerna 對比

```bash
# lerna + yarn 需要：
# 1. lerna.json
# 2. yarn workspaces 配置
# 3. lerna bootstrap
# 4. lerna publish

# pnpm workspace：
# 1. pnpm-workspace.yaml
# 2. pnpm install
# 3. 發佈可以用 pnpm publish 或 changeset
```

```bash
# 用 changeset 管理版本和發包
pnpm add -Dw @changesets/cli

# 初始化
pnpm changeset init

# 記錄變更
pnpm changeset

# 升級版本
pnpm changeset version

# 發佈
pnpm changeset publish
```

## 選擇性構建

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
# CI 中只構建變更的包
- name: Build changed packages
  run: pnpm -r --changed run build
```

## 小結

- pnpm workspace 是管理 Monorepo 最輕量的選擇，不需要額外工具
- `workspace:*` 聲明內部依賴，修改立刻生效
- 嚴格依賴管理杜絕幽靈依賴問題
- 硬鏈接節省磁盤空間，安裝速度也更快
- 配合 changeset 管理版本和發佈，流程自動化
