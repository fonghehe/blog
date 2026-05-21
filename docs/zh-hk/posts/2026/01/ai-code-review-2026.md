---
title: "AI 代碼審查 2026 最佳實踐"
date: 2026-01-02 10:00:00
tags:
  - 工程化
readingTime: 3
description: "AI 代碼審查已經從\"nice to have\"變成了團隊的標配。但很多人用錯了方式——要麼過度依賴 AI 導致自己不動腦，要麼只用 AI 做 linting 的升級版。本文分享我在三個大型項目中總結的 AI Code Review 落地經驗。"
wordCount: 473
---

AI 代碼審查已經從"nice to have"變成了團隊的標配。但很多人用錯了方式——要麼過度依賴 AI 導致自己不動腦，要麼只用 AI 做 linting 的升級版。本文分享我在三個大型項目中總結的 AI Code Review 落地經驗。

## 選擇正確的審查模式

不同的代碼變更需要不同的審查策略。小改動用自動審查，大重構用深度分析模式，安全敏感的變更必須人工+AI 聯合審查。

```yaml
# .code-review.yaml —— 團隊的 AI 審查配置
review:
  modes:
    auto:
      # < 50 行變更，自動審查，自動批准
      maxLines: 50
      maxFiles: 3
      autoApprove: true
      model: claude-4.7-haiku

    standard:
      # 50-300 行變更，標準審查
      maxLines: 300
      model: claude-4.7-sonnet
      checks:
        - code-quality
        - performance
        - type-safety
        - test-coverage

    deep:
      # > 300 行或涉及核心模塊，深度審查
      model: claude-4.7-opus
      checks:
        - architecture-consistency
        - security-audit
        - breaking-change-detection
        - migration-path-analysis

  rules:
    - pattern: "src/api/**"
      mode: deep
      requiredReviewers: ["@backend-team"]
    - pattern: "src/components/ui/**"
      mode: auto
```

## AI 審查 Prompt 的最佳實踐

AI 審查的質量完全取決於你給它的上下文和指令。好的 prompt 讓 AI 抓到真正的 bug，差的 prompt 只會產出"建議加註釋"這種廢話。

```typescript
// review-prompts.ts —— 我們團隊沉澱的審查 prompt 模板
export const reviewPrompts = {
  performance: `
審查以下代碼變更的性能問題，重點關注：
1. 不必要的重渲染：檢查 React 組件是否有缺失的 memo/useMemo/useCallback
2. 數據獲取：檢查是否有 N+1 查詢、缺失的緩存策略
3. Bundle 影響：新增的依賴是否可以用已有依賴替代
4. 內存泄漏：檢查未清理的 subscription、timer、observer

只報告真正有問題的地方，不要提"代碼風格"或"可以加註釋"。
如果有問題，給出具體的修復代碼。
  `,

  breakingChange: `
分析此 PR 是否引入 breaking changes：
1. 導出的 API 是否有簽名變化
2. 組件 props 是否有刪除或類型變更
3. CSS class 名是否變化（對外部消費者有影響）
4. 環境變量或配置項是否變更

如果檢測到 breaking change，説明影響範圍並建議遷移方案。
  `,

  security: `
審查此變更的安全性：
1. 用户輸入是否經過校驗和轉義
2. 敏感數據是否被正確處理（不記日誌、不暴露到前端）
3. 權限校驗是否到位
4. 是否引入了新的攻擊面（SSRF、SSCS 等）
  `,
};
```

## 將 AI 審查集成到 CI/CD 流水線

AI 審查不是替人做決策，而是幫人做信息篩選。在 CI 中集成時，關鍵是讓 AI 做初篩，把需要人工關注的點高亮出來。

```typescript
// .github/workflows/ai-review.ts
import { Octokit } from '@octokit/rest';
import { ClaudeReview } from '@ai-review/sdk';

async function runReview(prNumber: number) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const reviewer = new ClaudeReview({ model: 'claude-4.7-sonnet' });

  const { data: files } = await octokit.pulls.listFiles({
    owner: 'myorg',
    repo: 'frontend',
    pull_number: prNumber,
  });

  const results = await reviewer.review({
    diff: files.map((f) => ({
      path: f.filename,
      patch: f.patch ?? '',
      status: f.status,
    })),
    context: {
      baseBranch: 'main',
      prTitle: (await octokit.pulls.get({
        owner: 'myorg',
        repo: 'frontend',
        pull_number: prNumber,
      })).data.title,
    },
  });

  // AI 將問題分級，只有 high 和 critical 需要人工處理
  const criticalIssues = results.issues.filter(
    (i) => i.severity === 'critical' || i.severity === 'high'
  );

  if (criticalIssues.length > 0) {
    await octokit.issues.createComment({
      owner: 'myorg',
      repo: 'frontend',
      issue_number: prNumber,
      body: formatReviewComment(criticalIssues),
    });
    // 阻止自動合併
    process.exit(1);
  }
}
```

## 避免常見陷阱

最大的陷阱是"AI 説沒問題就真的沒問題"。AI 會遺漏業務邏輯錯誤、上下文依賴的問題、以及團隊約定俗成的隱含規則。我的做法是：AI 負責機械性檢查（類型安全、性能模式、常見 bug pattern），人負責業務正確性和架構一致性。

```typescript
// 反模式：AI 審查意見不經過人工判斷就自動 apply
// 千萬不要這樣做
const autoApplyAISuggestions = true; // 危險！

// 正確做法：AI 標註問題，人工決定是否採納
const reviewWorkflow = {
  aiFirstPass: {
    autoApply: false,
    generateSuggestions: true,
    // AI 只生成建議，不直接修改代碼
  },
  humanReview: {
    showAIInsights: true,
    showConfidenceScore: true,
    // 低置信度的建議摺疊顯示，高置信度的高亮
    collapseLowConfidence: true,
  },
};
```

## 小結

- AI 審查應該分模式：小改自動過，大改深度分析
- 好的審查 prompt 比好的審查工具更重要，要針對不同維度寫專用 prompt
- CI 集成時 AI 做初篩，人工做終審，不要反過來
- AI 審查最大的價值是"減少人看垃圾信息的時間"，而不是替代人的判斷
- 始終保持一個信念：AI 會遺漏，人是最終的質量守門員
