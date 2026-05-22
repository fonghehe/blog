---
title: "Biome：Rust 寫的前端工具鏈，真的能替代 ESLint + Prettier 嗎"
date: 2024-03-08 15:28:27
tags:
  - ESLint
readingTime: 2
description: "Biome 1.0 釋出，宣稱能替代 ESLint + Prettier。來看看實際體驗怎麼樣。"
wordCount: 348
---

Biome 1.0 釋出，宣稱能替代 ESLint + Prettier。來看看實際體驗怎麼樣。

## 先說速度

在一箇中等規模專案（約 200 個 TS/TSX 檔案）：

```
ESLint + Prettier（Node.js）：~8s
Biome（Rust）：~0.4s

20倍的速度差
```

這個差距在 CI 上很明顯，本地開發的感受差異沒有那麼大。

## 安裝和設定

```bash
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

```json
// biome.json（比 .eslintrc + .prettierrc 簡單得多）
{
  "$schema": "https://biomejs.dev/schemas/1.5.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
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
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

## 常用命令

```bash
# 格式化
npx biome format --write .

# Lint 檢查
npx biome lint .

# 同時格式化 + lint（最常用）
npx biome check --write .

# CI 模式（不修改檔案，隻檢查）
npx biome ci .
```

## 和現有專案遷移

Biome 提供了遷移命令：

```bash
# 從 ESLint 遷移
npx @biomejs/biome migrate eslint --write

# 從 Prettier 遷移
npx @biomejs/biome migrate prettier --write
```

實際遷移體驗：大部分規則能自動轉換，但有些 ESLint 外掛（如 `eslint-plugin-react-hooks`）還沒有 Biome 等價實現。

## 目前的不足

**規則覆蓋率不夠**：

| 場景                | ESLint 外掛               | Biome 支援                         |
| 
------------------- | ------------------------- | ---------------------------------- |
| React Hooks 規則    | eslint-plugin-react-hooks | 部分支援（hooks-of-components 等） |
| 無障礙檢查          | eslint-plugin-jsx-a11y    | 基礎支援                           |
| Import 排序         | eslint-plugin-import      | ✅ 內建                            |
| TypeScript 型別檢查 | @typescript-eslint        | 部分支援                           |

**生態不成熟**：很多第三方 ESLint 外掛沒有 Biome 版本。

## 我的建議

**新專案**：直接用 Biome，享受開箱即用的速度。

**現有專案**：

```
如果你的專案主要用官方規則（無太多第三方外掛）→ 值得遷移
如果嚴重依賴 @typescript-eslint、react-hooks 等外掛 → 等 Biome 生態成熟
```

**混用方案**（我目前的實踐）：

```json
// package.json
{
  "scripts": {
    "format": "biome format --write .",
    "lint": "biome lint . && eslint . --max-warnings 0",
    "check": "biome check --write . && eslint . --max-warnings 0"
  }
}
```

用 Biome 替代 Prettier（格式化），用 ESLint 處理型別相關的 lint。這樣速度和覆蓋率都能兼顧。

## 小結

- Biome 速度比 ESLint + Prettier 快 20 倍左右
- 配置比 ESLint + Prettier 簡單得多
- 規則覆蓋率還不如 ESLint 生態完整，特別是 react-hooks
- 新專案推薦，老專案視情況遷移
- 混用：用 Biome 格式化 + ESLint lint 是個好折中