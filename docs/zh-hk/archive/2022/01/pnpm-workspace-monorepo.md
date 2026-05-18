---
title: "pnpm Workspace：告別 node_modules 地獄的 Monorepo 方案"
date: 2022-01-10 11:13:23
tags:
  - 前端工程化
readingTime: 2
description: "團隊把多個前端項目遷移到 pnpm workspace 已經半年了。磁盤佔用降了 60%，安裝速度提升明顯，幽靈依賴問題徹底解決。這篇文章記錄我們的實踐過程。"
---

團隊把多個前端項目遷移到 pnpm workspace 已經半年了。磁盤佔用降了 60%，安裝速度提升明顯，幽靈依賴問題徹底解決。這篇文章記錄我們的實踐過程。

## 為什麼選 pnpm

npm 和 yarn 的 node_modules 是扁平結構，依賴提升帶來兩個問題：

1. **幽靈依賴**：你可以在代碼裏 import 沒聲明的包（因為被提升到了頂層）
2. **磁盤浪費**：不同項目各自維護一份完整的 node_modules

pnpm 用硬鏈接 + 內容尋址存儲解決這兩個問題：

```bash
# 全局安裝 pnpm
npm install -g pnpm@7

# 查看全局存儲
pnpm store path
# ~/.local/share/pnpm/store/v3
```

## 項目結構

我們前端 monorepo 的結構：

```
frontend-monorepo/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── ui-components/        # 組件庫
│   ├── utils/                # 工具函數
│   ├── eslint-config/        # ESLint 共享配置
│   └── ts-config/            # TypeScript 共享配置
├── apps/
│   ├── admin/                # 後台管理
│   ├── h5/                   # 移動端 H5
│   └── docs/                 # 文檔站
└── pnpm-lock.yaml
```

## pnpm-workspace.yaml 配置

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

根目錄 `package.json`：

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

## 工作區依賴管理

```bash
# 給 admin 項目安裝 ui-components（workspace 協議）
pnpm --filter admin add ui-components@workspace:*

# 給 admin 安裝 lodash（只裝在 admin）
pnpm --filter admin add lodash

# 給所有項目安裝 typescript（作為 devDependencies）
pnpm -r add -D typescript

# 給根目錄安裝全局開發工具
pnpm add -D -w husky lint-staged
```

安裝後 `admin/package.json` 的依賴會是這樣：

```json
{
  "dependencies": {
    "ui-components": "workspace:*",
    "lodash": "^4.17.21"
  }
}
```

`workspace:*` 表示永遠使用本地版本，發佈時 pnpm 會自動替換成真實版本號。

## .npmrc 配置

```ini
# 使用嚴格模式，不能訪問未聲明的依賴
strict-peer-dependencies=false

# 在項目級別創建 node_modules，保持兼容性
node-linker=hoisted

# 使用公共的 lockfile
shared-workspace-lockfile=true

# 自動安裝 peerDependencies
auto-install-peers=false
```

`node-linker` 有三個選項：
- `isolated`（默認）：嚴格的符號鏈接結構，兼容性最差但最安全
- `hoisted`：類似 npm/yarn 的扁平結構，兼容性最好
- `hoisted`：折中方案

我們選 `hoisted` 是因為有些老依賴不支持嚴格的 node_modules 結構。

## 過濾器的妙用

```bash
# 只執行 admin 及其依賴的 build
pnpm --filter admin... build

# 執行 ui-components 被依賴的所有項目
pnpm --filter '...ui-components' build

# 結合使用：build 受影響的項目
pnpm --filter '...ui-components' --filter 'admin...' build

# 排除某些包
pnpm -r --no-filter docs test
```

這在 CI 裏特別有用——只 build 和 test 有變更的項目。

## 踩坑記錄

### 1. peerDependencies 警告

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

pnpm 對 peerDependencies 嚴格，每個消費方都需要顯式安裝 react。

### 2. Workspace 協議的版本範圍

```json
"ui-components": "workspace:^"   // 發佈時替換為 ^1.2.3
"ui-components": "workspace:*"   // 發佈時替換為 1.2.3（精確版本）
"ui-components": "workspace:~"   // 發佈時替換為 ~1.2.3
```

### 3. 腳本執行順序

```bash
# 按拓撲排序執行（先執行依賴，再執行消費方）
pnpm -r --workspace-concurrency=1 build

# 並行執行（更快但要確保 build 之間沒有依賴）
pnpm -r build
```

## 遷移步驟總結

```bash
# 1. 全局安裝 pnpm
npm install -g pnpm@7

# 2. 刪除舊的 lock 文件和 node_modules
rm -rf node_modules package-lock.json yarn.lock

# 3. 初始化 workspace
echo "packages:
  - 'packages/*'
  - 'apps/*'" > pnpm-workspace.yaml

# 4. 安裝依賴
pnpm install

# 5. 用 pnpm filter 替換原來的腳本
```

## 小結

pnpm workspace 在磁盤效率和依賴隔離上做到了最佳平衡。對於前端 monorepo，它是目前最務實的選擇。接下來我會寫 Turborepo 來做構建編排，配合 pnpm 組成完整的 monorepo 工具鏈。