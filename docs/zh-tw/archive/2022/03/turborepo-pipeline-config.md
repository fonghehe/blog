---
title: "Turborepo：Monorepo 構建編排的最佳拍檔"
date: 2022-03-08 10:39:07
tags:
  - 前端
readingTime: 3
description: "上一篇寫了 pnpm workspace 做依賴管理。這篇講構建編排——當你的 monorepo 有十幾個包需要構建和測試，怎麼讓它們按依賴順序執行，並且儘可能並行？"
wordCount: 444
---

上一篇寫了 pnpm workspace 做依賴管理。這篇講構建編排——當你的 monorepo 有十幾個包需要構建和測試，怎麼讓它們按依賴順序執行，並且儘可能並行？

Turborepo 是答案。它是一個構建編排工具，不替代 pnpm，而是和 pnpm 配合。

## 安裝與初始化

```bash
# 在已有的 pnpm workspace 專案中
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

關鍵配置解釋：

- `dependsOn: ["^build"]`：表示當前包的 build 依賴其所有 workspace 依賴的 build（`^` 表示依賴）
- `dependsOn: ["build"]`：表示 test 依賴當前包自己的 build
- `outputs`：構建產物路徑，Turborepo 用來做快取
- `cache: false`：dev 不快取
- `persistent: true`：dev 是長駐程序

## 執行命令

```bash
# 構建所有包（按拓撲排序 + 並行）
turbo run build

# 只構建有變更的包
turbo run build --filter=...[HEAD]

# 構建 admin 及其所有依賴
turbo run build --filter=admin...

# 測試所有包
turbo run test

# 並行執行多個任務
turbo run build test lint

# 開發模式（所有包同時啟動）
turbo run dev --parallel
```

## 遠端快取

Turborepo 最有吸引力的特性——CI 和本地共享構建快取：

```bash
# 登入 Vercel（Turborepo 官方託管）
npx turbo login

# 連結遠端快取
npx turbo link
```

也可以自建遠端快取：

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

效果：第一次 CI 構建後，後續的 PR 如果沒改構建原始碼，直接命中快取，構建從 3 分鐘降到 5 秒。

## 實際專案配置

我們的 monorepo 結構：

```
frontend-monorepo/
├── packages/
│   ├── ui-components/     # 構建產物 dist/
│   ├── utils/             # 構建產物 dist/
│   ├── eslint-config/     # 無構建，只有 lint
│   └── ts-config/         # 無構建
├── apps/
│   ├── admin/             # 構建產物 dist/
│   ├── h5/                # 構建產物 dist/
│   └── docs/              # 構建產物 dist/
└── turbo.json
```

對應的 turbo.json：

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

`globalDependencies` 定義了影響所有包的檔案——這些檔案變了，所有快取都會失效。

## 過濾器的高階用法

```bash
# 構建所有 apps 目錄下的包
turbo run build --filter='./apps/*'

# 構建 ui-components 及其所有消費方
turbo run build --filter='...ui-components'

# 排除 docs 包
turbo run build --filter='!docs'

# 組合：構建受當前 git diff 影響的包
turbo run build --filter='...[HEAD^]'
```

## GitHub Actions 整合

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
          fetch-depth: 0  # 需要完整歷史來判斷變更

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
|
------|---------------|-----------|
| 依賴管理 | 負責 | 不管 |
| workspace 協議 | 負責 | 不管 |
| 構建編排 | 基礎（-r） | 負責 |
| 並行執行 | 基礎 | 智慧並行 |
| 構建快取 | 沒有 | 本地 + 遠端 |
| 任務管道 | 沒有 | 完整支援 |

簡單說：pnpm 管依賴，Turborepo 管構建。

## 小結

Turborepo 是 monorepo 構建編排的輕量級方案。它不做包管理（pnpm 做），只專注於任務編排和快取。對於中小型 monorepo，pnpm + Turborepo 的組合已經足夠好。如果需要更重的功能（版本管理、changelog 生成），可以再加 Changesets。