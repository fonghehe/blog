---
title: "Turborepo：前端 Monorepo 的任務編排引擎"
date: 2023-11-25 14:31:00
tags:
  - 前端工程化
readingTime: 2
description: "Turborepo 成熟了。在我們的 15 個包的 monorepo 中使用了大半年，分享一下實踐經驗。"
wordCount: 395
---

Turborepo 成熟了。在我們的 15 個包的 monorepo 中使用了大半年，分享一下實踐經驗。

## 為什麼選 Turborepo

Monorepo 工具選型：

- **Nx**：功能最全，但學習曲線陡峭，對非 JS 專案有偏好
- **Lerna**：版本管理為主，任務編排能力弱
- **Turborepo**：專注任務編排和快取，上手簡單，和 pnpm 配合好

我們的需求很簡單：任務編排 + 快取 + 並行執行。不需要 Nx 的全套功能。

## 基礎配置

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]
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

- `dependsOn: ["^build"]`：先構建所有依賴包（`^` 表示依賴）
- `outputs`：定義快取的產出檔案
- `inputs`：定義影響快取的輸入檔案（精確控制快取失效）
- `cache: false`：dev 模式不快取

## 工作原理

```
turbo build

1. 解析所有包的 package.json，構建依賴圖
2. 按拓撲排序確定構建順序
3. 並行執行沒有依賴關係的任務
4. 每個任務的輸入（原始碼 + 依賴 hash + 環境變數）生成 hash
5. 如果 hash 命中遠端快取，跳過執行，直接恢復 outputs
6. 執行結果上傳到遠端快取
```

## 實際效果

```
# 首次構建（無快取）
turbo build:  45s

# 只改了一個包的程式碼
turbo build:  3s  （其餘 14 個包命中快取）

# CI 中 PR 重複構建
turbo build:  <1s （全部命中遠端快取）
```

## 遠端快取

```bash
# 使用 Vercel Remote Cache（免費額度夠用）
npx turbo login
npx turbo link

# 或者自建遠端快取
# 使用 turbo-server 或第三方方案
```

遠端快取讓 CI 和本地共享構建快取。同事已經構建過的程式碼，你拉下來直接用快取。

## 與 pnpm workspace 配合

```jsonc
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"

// package.json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev --parallel"
  }
}
```

pnpm 管依賴解析和安裝，Turbo 管任務執行和快取。職責清晰。

## 過濾和選擇性執行

```bash
# 只構建某個包及其依賴
turbo run build --filter=@company/ui

# 只構建有變更的包
turbo run build --filter=[HEAD^1]

# 排除某些包
turbo run build --filter='!@company/docs'

# 只構建 apps 目錄下的包
turbo run build --filter='./apps/*'
```

## 全域性依賴和快取失效

```jsonc
// turbo.json
{
  "globalDependencies": [
    // 這些檔案變化會導致所有任務快取失效
    ".env",
    "tsconfig.base.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      // 精確到每個任務的輸入檔案
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    }
  }
}
```

`globalDependencies` 很重要。如果忘記配置 `tsconfig.base.json`，改了基礎配置但快取不過期，會出詭異的構建問題。

## 小結

- Turborepo 專注做一件事：任務編排 + 快取，做得很好
- 與 pnpm workspace 天然配合，各司其職
- 遠端快取是殺手級功能，CI 構建時間可以降到秒級
- 配置簡單，`turbo.json` 一個檔案搞定
- 不需要 Nx 那樣的學習成本，適合大多數前端 monorepo