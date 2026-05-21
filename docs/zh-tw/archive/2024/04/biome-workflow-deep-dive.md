---
title: "Biome 完整工作流：從遷移、CI 整合到團隊規範"
date: 2024-04-28 14:31:44
tags:
  - 前端
readingTime: 2
description: "之前寫過 Biome 能否替代 ESLint + Prettier 的分析。經過幾個月在團隊中全面推廣，整理一下完整的工作流經驗。"
wordCount: 469
---

之前寫過 Biome 能否替代 ESLint + Prettier 的分析。經過幾個月在團隊中全面推廣，整理一下完整的工作流經驗。

## 遷移策略：漸進式替換

不建議一步到位。我們的路徑：

```
階段 1：Biome 作為 formatter 替代 Prettier（風險最低）
階段 2：Biome 作為 linter，和 ESLint 並行執行
階段 3：逐步關閉 ESLint 規則，Biome 接管
階段 4：移除 ESLint + Prettier 依賴
```

### 階段 1：格式化遷移

```bash
# 安裝 Biome
pnpm add -D @biomejs/biome

# 生成配置
npx @biomejs/biome init
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.7.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": {
    "enabled": true
  }
}
```

關鍵一步：格式化現有程式碼並做一次大提交，避免 diff 汙染後續 PR：

```bash
npx @biomejs/biome format --write .
git add -A && git commit -m "chore: apply biome formatting to all files"
```

### 階段 2-3：Linter 遷移

```json
// biome.json 補充 linter 配置
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useTemplate": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": ["error", { "max": 15 }]
      }
    }
  }
}
```

### ESLint 規則對映表

我們維護了一份對映表，確保不遺漏：

```json
// eslint-to-biome-mapping.json
{
  "react-hooks/exhaustive-deps": "correctness/useExhaustiveDependencies",
  "@typescript-eslint/no-unused-vars": "correctness/noUnusedVariables",
  "no-unused-vars": "correctness/noUnusedVariables",
  "eqeqeq": "suspicious/noDoubleEquals",
  "no-console": "suspicious/noConsoleLog",
  "prefer-const": "style/useConst"
}
```

## CI 整合

```yaml
# .github/workflows/lint.yml
name: Lint
on: [push, pull_request]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .
```

`biome ci` 命令會：
- 檢查格式（format）
- 檢查 lint
- 檢查 import 排序
- 以非零退出碼失敗時阻斷 CI

### Pre-commit Hook

```json
// package.json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint"
  }
}
```

## 遇到的問題

### 1. 規則不完全對等

Biome 的規則和 ESLint 不是 1:1 對映。有些 ESLint 外掛規則（如 `eslint-plugin-react` 的某些規則）Biome 還不支援。

解決方案：保留少量 ESLint 規則作為補充，用 `eslint-plugin-only-warn` 降級為 warning。

### 2. ignore 檔案差異

Biome 用 `.biomeignore` 而不是 `.eslintignore`，語法略有不同：

```
# .biomeignore
dist/
build/
*.min.js
```

### 3. IDE 整合

VS Code 的 Biome 擴充套件比 ESLint 擴充套件年輕，偶爾會有卡頓。解決方案是重啟 LSP server。

## 團隊落地經驗

**關鍵：一次格式化提交**。不做這一步，每個 PR 都混著格式變更，review 極其痛苦。

**CI 必須強制**。光靠本地 IDE 提示不夠，CI 不通過就無法合併。

**團隊培訓**。花了 30 分鐘給團隊做了個內部分享，重點講規則含義而不是配置語法。

## 小結

- 漸進式遷移：formatter → linter（並行）→ linter（接管）→ 移除舊依賴
- 格式化先做一次大提交，避免 diff 汙染
- CI 必須用 `biome ci` 命令強制檢查
- 維護 ESLint → Biome 規則對映表，確保不遺漏
- 團隊落地速度約 2 周，主要成本在第一次格式化