---
title: "AI 輔助 Code Review：8 人團隊的落地實踐"
date: 2024-02-20 17:22:08
tags:
  - 前端
readingTime: 3
description: "作為前端平台負責人，從去年開始嘗試將 AI 引入 Code Review 流程。經過幾個月的實踐，整理一下我們的經驗和踩過的坑。"
---

作為前端平台負責人，從去年開始嘗試將 AI 引入 Code Review 流程。經過幾個月的實踐，整理一下我們的經驗和踩過的坑。

## 為什麼需要 AI 輔助

我們 8 人團隊每週約 40-50 個 PR，人工 review 經常成為瓶頸：

- 資深工程師時間有限，review 經常積壓
- 簡單問題（命名、格式、n+1 查詢）佔 review 時間的 60%+
- 新人代碼質量波動大，需要更多關注

目標是讓 AI 處理 60% 的機械性檢查，人類聚焦架構和設計。

## 我們的方案

### 第一層：Biome + 類型檢查（零延遲）

```json
// biome.json 核心配置
{
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "error"
      },
      "suspicious": {
        "noExplicitAny": "error"
      },
      "complexity": {
        "noExcessiveCognitiveComplexity": ["error", { "max": 15 }]
      }
    }
  }
}
```

### 第二層：AI Review Bot（PR 級別）

我們用 GitHub Actions + Claude API 做自動 review：

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: AI Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # 獲取 diff
          DIFF=$(gh pr diff ${{ github.event.pull_request.number }})

          # 調用 Claude API
          node scripts/ai-review.mjs "$DIFF"
```

核心 prompt 設計：

```typescript
// scripts/ai-review.mjs
const SYSTEM_PROMPT = `你是一個資深前端 Code Reviewer。請審查以下代碼變更：

重點關注：
1. 潛在的運行時錯誤
2. 性能問題（不必要的重渲染、大列表無虛擬化）
3. 安全問題（XSS、注入、敏感信息泄露）
4. API 設計一致性
5. React/Vue 最佳實踐

格式：
- 🔴 嚴重：必須修復
- 🟡 建議：最好修復
- 🟢 肯定：寫得好的地方

不要檢查：代碼格式、變量命名風格（由 Biome 處理）`;
```

### 第三層：人工 Review（AI 只作為參考）

AI 的輸出作為 PR 評論的第一條，人工 reviewer 可以參考但不盲從。

## 關鍵經驗

### 做對了什麼

**Prompt 必須具體**。早期我們用泛泛的 prompt，AI 經常輸出 "代碼看起來不錯" 這種廢話。明確指定檢查項後，有效建議比例從 20% 提升到 65%。

**分離關注點**。格式檢查和 lint 給 Biome，AI 專注邏輯和架構。不要讓 AI 做工具能做得更好的事。

**限制上下文**。只發送 diff，不要發整個文件。既省 token，又讓 AI 聚焦變更。

### 踩過的坑

**誤報率初期很高**。AI 會把合理的代碼標記為問題。我們做了兩週的 prompt 迭代，重點是告訴 AI 項目的上下文（我們用 Vue 3 組合式 API、TypeScript strict 模式）。

**Token 消耗需控制**。大 PR 的 diff 可能很大。我們設了 500 行限制，超過的建議拆分 PR。

**不能替代架構討論**。AI 不理解業務上下文，架構層面的決策必須人工 review。

## 效果數據

經過 3 個月實踐：

- PR review 平均等待時間從 4.2 小時降到 1.8 小時
- 合入前發現的問題數量增加 35%（AI 發現的 + 人工發現的）
- 生產環境 bug 率下降約 20%
- 資深工程師用於 review 的時間減少 40%

## 小結

- AI Code Review 適合處理機械性檢查，不適合架構決策
- Prompt 工程是關鍵，需要針對團隊技術棧定製
- 分層策略（lint → AI → 人工）效果最好
- 別期望 AI 替代人，而是讓 AI 處理低價值工作，釋放人的精力
- 持續迭代 prompt，基於實際誤報率調整