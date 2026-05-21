---
title: "Turborepo 初探：高性能 Monorepo 構建"
date: 2021-11-08 15:28:08
tags:
  - 前端工程化
readingTime: 2
description: "Vercel 收購了 Turborepo 並開源，這是一個用 Go 寫的高性能 Monorepo 構建工具。試用了一週，和 Lerna / pnpm workspace 對比了一下。"
wordCount: 367
---

Vercel 收購了 Turborepo 並開源，這是一個用 Go 寫的高性能 Monorepo 構建工具。試用了一週，和 Lerna / pnpm workspace 對比了一下。

## Monorepo 的痛點

用 pnpm workspace 管理 monorepo 項目，包管理沒問題，但構建編排很原始：

```bash
# pnpm workspace 的構建方式
pnpm run build --filter=packages/core
pnpm run build --filter=packages/utils
pnpm run build --filter=packages/ui
pnpm run build --filter=apps/web

# 問題：
# 1. 手動排構建順序
# 2. 沒有緩存（每次全量構建）
# 3. CI 上更慢（沒有本地緩存）
```

## Turborepo 解決什麼

- **構建緩存**：相同輸入不重複構建（本地 + 遠程緩存）
- **並行調度**：自動分析依賴圖，並行構建無依賴的包
- **增量構建**：只構建有變化的包及其下游依賴

## 基本配置

```bash
# 安裝
npm install -D turbo
```

```jsonc
// turbo.json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],       // 先構建依賴的包
      "outputs": ["dist/**"]          // 緩存這些產物
    },
    "dev": {
      "cache": false,                 // dev 不緩存（持續運行）
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    }
  }
}
```

```jsonc
// packages/ui/package.json
{
  "name": "@myorg/ui",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "lint": "eslint src/"
  }
}

// apps/web/package.json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:*"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "lint": "eslint src/"
  }
}
```

## 運行

```bash
# 構建所有包（自動分析依賴圖，並行執行）
turbo run build

# 只構建某個包及其依賴
turbo run build --filter=@myorg/web

# 並行運行所有 dev
turbo run dev --parallel

# 運行所有 lint（無依賴，完全並行）
turbo run lint
```

## 緩存機制

```bash
# 第一次構建
turbo run build
# packages/core:   build (2.3s)
# packages/utils:  build (1.1s)
# packages/ui:     build (3.5s)
# apps/web:        build (5.2s)

# 沒有任何改動，第二次構建
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)
# packages/utils:  build >>> FULL TURBO (cached, 0.0s)
# packages/ui:     build >>> FULL TURBO (cached, 0.0s)
# apps/web:        build >>> FULL TURBO (cached, 0.0s)

# 只改了 utils，第三次構建
turbo run build
# packages/core:   build >>> FULL TURBO (cached, 0.0s)    # 沒變
# packages/utils:  build (1.2s)                             # 重新構建
# packages/ui:     build (3.4s)                             # 依賴 utils，重新構建
# apps/web:        build (5.1s)                             # 依賴 ui，重新構建
```

緩存 key 基於：源文件內容 + 環境變量 + lock 文件 + package.json scripts。

## 遠程緩存（CI 場景）

```bash
# 登錄 Vercel（免費提供遠程緩存）
npx turbo login

# 鏈接遠程緩存
npx turbo link

# 之後 turbo run build 自動同步緩存到 Vercel
# 本地構建一次 → CI 直接用緩存
```

CI 配置示例：

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 6
      - uses: actions/setup-node@v3
        with:
          node-version: 16
          cache: 'pnpm'

      - run: pnpm install

      # Turborepo 自動使用遠程緩存
      # 如果本地已經構建過，CI 直接用緩存
      - run: pnpm turbo run build test lint
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

## 和 Lerna 對比

| 特性 | Lerna | Turborepo |
|
------|-------|-----------|
| 構建編排 | 依賴 topo 排序 | 自動依賴圖 + 並行 |
| 緩存 | 無 | 本地 + 遠程 |
| 增量構建 | 無 | 自動 |
| 包發佈 | 有（核心功能） | 無（不管發佈） |
| 配置複雜度 | 中等 | 極簡 |

Lerna 管發佈，Turborepo 管構建，可以一起用。

## 和 pnpm workspace 配合

```bash
# pnpm 管依賴，Turborepo 管構建編排
# 這是目前最推薦的組合

# package.json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "turbo run test",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "^1.0.0",
    "pnpm": "7.x"  // pnpm 用 workspace 協議管理依賴
  }
}
```

## 小結

- Turborepo 解決 Monorepo 的構建編排和緩存問題，不解決包發佈問題
- 本地 + 遠程緩存是最大賣點，CI 構建時間可以從分鐘級降到秒級
- 和 pnpm workspace 配合是最優方案：pnpm 管依賴，Turborepo 管構建
- 配置極簡（一個 turbo.json），學習成本低
- 適合有 3+ 包的 Monorepo 項目；包少的話 pnpm workspace 夠用