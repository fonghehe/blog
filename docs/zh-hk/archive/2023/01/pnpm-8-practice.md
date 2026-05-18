---
title: "pnpm 8：更快、更嚴格的包管理實踐"
date: 2023-01-25 14:31:47
tags:
  - 前端
readingTime: 2
description: "pnpm 8 發佈了，作為我們團隊的默認包管理器，升級後做了全面的性能對比測試。"
---

pnpm 8 發佈了，作為我們團隊的默認包管理器，升級後做了全面的性能對比測試。

## 核心改進

### 更快的安裝速度

pnpm 8 對解析和鏈接階段做了優化，在大型 monorepo 中提升明顯：

```bash
# 我們項目的實際測試（1200+ 依賴，monorepo 含 15 個包）
# 冷安裝（clean install）
npm:   89s
yarn:  62s
pnpm7: 38s
pnpm8: 24s

# 熱安裝（已有 lockfile，node_modules 被刪除）
pnpm8: 11s
```

### Node.js 18+ 要求

pnpm 8 要求最低 Node.js 18，這是正確的決定。Node 16 已經 EME（維護期結束），放棄舊版本支持換來更好的性能。

### 更嚴格的依賴處理

默認行為變化：

```jsonc
// .npmrc
// pnpm 8 默認 strict-peer-dependencies = true
// 不再自動安裝 peer dependencies
```

這看起來是個破壞性變更，但其實是好事。之前自動安裝 peer dependencies 經常導致版本衝突。

## Monorepo 實踐

### workspace 協議

```jsonc
// packages/ui/package.json
{
  "name": "@company/ui",
  "dependencies": {
    "@company/utils": "workspace:*",
    "@company/types": "workspace:^"
  }
}
```

`workspace:*` 始終使用本地版本，`workspace:^` 發佈時會轉成 `^x.y.z`。這是 pnpm 原生支持的，不需要額外配置。

### 高效的依賴提升

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// .npmrc
public-hoist-pattern[]=*eslint*
public-hoist-pattern[]=*prettier*
```

`public-hoist-pattern` 控制哪些依賴提升到根目錄。和 npm/yarn 不同，pnpm 只提升你明確指定的包，避免幽靈依賴。

### 過濾命令

```bash
# 只在 apps 目錄下執行構建
pnpm --filter="./apps/*" build

# 只構建 @company/ui 及其依賴
pnpm --filter "@company/ui..." build

# 構建所有依賴了 @company/utils 的包
pnpm --filter "...@company/utils" build
```

## 與 Turborepo 配合

```jsonc
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**", "test/**"]
    }
  }
}
```

pnpm workspace + Turborepo 是目前 monorepo 最佳組合。pnpm 管依賴，Turbo 管任務編排和緩存。

## 遷移注意點

```bash
# 從 pnpm 7 升級
pnpm -v  # 確認是 8.x

# 重新生成 lockfile
pnpm install --no-frozen-lockfile

# 檢查 peer dependency 警告
pnpm install 2>&1 | grep "peer dep"
```

## 小結

- pnpm 8 安裝速度提升約 35-40%（大型 monorepo）
- 默認嚴格 peer dependency 處理，減少了版本衝突
- Node.js 18+ 要求，擁抱現代運行時
- workspace 協議和過濾命令讓 monorepo 管理更高效
- 配合 Turborepo 是當前前端 monorepo 最優解