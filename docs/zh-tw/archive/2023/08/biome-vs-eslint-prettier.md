---
title: "Biome：Rust 時代的 Linter 和 Formatter"
date: 2023-08-08 10:39:00
tags:
  - ESLint
readingTime: 2
description: "Biome（原 Rome 專案重生）釋出了。用 Rust 重寫的 Linter + Formatter，對標 ESLint + Prettier。實測後說說值不值得換。"
wordCount: 518
---

Biome（原 Rome 專案重生）釋出了。用 Rust 重寫的 Linter + Formatter，對標 ESLint + Prettier。實測後說說值不值得換。

## 為什麼需要替代方案

ESLint + Prettier 的問題：

1. **慢**：大型專案 lint 一次要幾十秒到幾分鐘
2. **配置複雜**：`.eslintrc` + `.prettierrc` + `eslint-config-*` + 各種外掛
3. **規則衝突**：ESLint 的格式化規則和 Prettier 打架，需要 `eslint-config-prettier`
4. **Node.js 啟動開銷**：每次 lint 都有冷啟動成本

Biome 的目標：一個工具搞定 lint + format，零設定起步。

## 安裝和使用

```bash
# 安裝
pnpm add -D @biomejs/biome

# 初始化設定
pnpm biome init

# 格式化
pnpm biome format --write src/

# Lint
pnpm biome check src/

# Lint + Format 一步到位
pnpm biome check --apply src/
```

## 設定

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "useExhaustiveDependencies": "error",
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

一個 `biome.json` 解決所有設定，不需要裝任何外掛。

## 效能對比

在我們的專案上測試（~1500 個檔案，TS + TSX）：

```
ESLint + Prettier:
  lint:    34s
  format:  12s
  total:   46s

Biome:
  check:   0.8s

提速約 57 倍。
```

這不是微最佳化。CI 裡每次 PR 跑 lint 的時間從接近 1 分鐘降到不到 1 秒。

## 規則覆蓋

```
ESLint 核心規則:    ~300 條
Biome linter 規則:  ~170 條（持續增加）
```

Biome 的規則覆蓋了 ESLint 最常用的 80-90%。缺少的主要是：
- 框架特定規則（React exhaustive-deps 有，但 Vue 沒有）
- 社群外掛規則（import 排序有基礎支援，但不如 eslint-plugin-import 強大）

## 遷移策略

**階段一：隻用 Formatter**

```bash
# 用 Biome 替換 Prettier
pnpm remove prettier
pnpm add -D @biomejs/biome
```

這是風險最低的一步。Biome 的格式化輸出和 Prettier 高度相容（預設風格略有差異，可配置）。

**階段二：並行執行**

```jsonc
// package.json
{
  "scripts": {
    "lint:eslint": "eslint src/",
    "lint:biome": "biome check src/",
    "lint": "pnpm lint:eslint && pnpm lint:biome"
  }
}
```

對比兩個工具的輸出，看 Biome 是否漏報或誤報。

**階段三：全面切換**

確認沒問題後移除 ESLint 相關依賴。

## 目前的限製

- Vue/Svelte 支援還不成熟
- 自定義規則能力遠不如 ESLint（不能寫外掛）
- 部分 ESLint 規則沒有對應實現
- 生態系統小，社群規則包幾乎沒有

## 小結

- Biome 速度碾壓 ESLint + Prettier，50 倍以上的效能提升不是吹的
- 配置極簡，一個 JSON 檔案搞定 lint + format
- 規則覆蓋主流場景，但框架特定規則和生態不如 ESLint
- 建議先用 Formatter 替換 Prettier，Linter 規則按需遷移
- 新專案可以直接用 Biome；老專案評估規則覆蓋後再決定