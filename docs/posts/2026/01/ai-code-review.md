---
title: "AI 代码审查 2026 最佳实践"
date: 2026-01-02 13:36:13
tags:
  - 工程化
readingTime: 3
description: "AI 代码审查已经从\"nice to have\"变成了团队的标配。但很多人用错了方式——要么过度依赖 AI 导致自己不动脑，要么只用 AI 做 linting 的升级版。本文分享我在三个大型项目中总结的 AI Code Review 落地经验。"
wordCount: 473
---

AI 代码审查已经从"nice to have"变成了团队的标配。但很多人用错了方式——要么过度依赖 AI 导致自己不动脑，要么只用 AI 做 linting 的升级版。本文分享我在三个大型项目中总结的 AI Code Review 落地经验。

## 选择正确的审查模式

不同的代码变更需要不同的审查策略。小改动用自动审查，大重构用深度分析模式，安全敏感的变更必须人工+AI 联合审查。

```yaml
# .code-review.yaml —— 团队的 AI 审查配置
review:
  modes:
    auto:
      # < 50 行变更，自动审查，自动批准
      maxLines: 50
      maxFiles: 3
      autoApprove: true
      model: claude-4.7-haiku

    standard:
      # 50-300 行变更，标准审查
      maxLines: 300
      model: claude-4.7-sonnet
      checks:
        - code-quality
        - performance
        - type-safety
        - test-coverage

    deep:
      # > 300 行或涉及核心模块，深度审查
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

## AI 审查 Prompt 的最佳实践

AI 审查的质量完全取决于你给它的上下文和指令。好的 prompt 让 AI 抓到真正的 bug，差的 prompt 只会产出"建议加注释"这种废话。

```typescript
// review-prompts.ts —— 我们团队沉淀的审查 prompt 模板
export const reviewPrompts = {
  performance: `
审查以下代码变更的性能问题，重点关注：
1. 不必要的重渲染：检查 React 组件是否有缺失的 memo/useMemo/useCallback
2. 数据获取：检查是否有 N+1 查询、缺失的缓存策略
3. Bundle 影响：新增的依赖是否可以用已有依赖替代
4. 内存泄漏：检查未清理的 subscription、timer、observer

只报告真正有问题的地方，不要提"代码风格"或"可以加注释"。
如果有问题，给出具体的修复代码。
  `,

  breakingChange: `
分析此 PR 是否引入 breaking changes：
1. 导出的 API 是否有签名变化
2. 组件 props 是否有删除或类型变更
3. CSS class 名是否变化（对外部消费者有影响）
4. 环境变量或配置项是否变更

如果检测到 breaking change，说明影响范围并建议迁移方案。
  `,

  security: `
审查此变更的安全性：
1. 用户输入是否经过校验和转义
2. 敏感数据是否被正确处理（不记日志、不暴露到前端）
3. 权限校验是否到位
4. 是否引入了新的攻击面（SSRF、SSCS 等）
  `,
};
```

## 将 AI 审查集成到 CI/CD 流水线

AI 审查不是替人做决策，而是帮人做信息筛选。在 CI 中集成时，关键是让 AI 做初筛，把需要人工关注的点高亮出来。

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

  // AI 将问题分级，只有 high 和 critical 需要人工处理
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
    // 阻止自动合并
    process.exit(1);
  }
}
```

## 避免常见陷阱

最大的陷阱是"AI 说没问题就真的没问题"。AI 会遗漏业务逻辑错误、上下文依赖的问题、以及团队约定俗成的隐含规则。我的做法是：AI 负责机械性检查（类型安全、性能模式、常见 bug pattern），人负责业务正确性和架构一致性。

```typescript
// 反模式：AI 审查意见不经过人工判断就自动 apply
// 千万不要这样做
const autoApplyAISuggestions = true; // 危险！

// 正确做法：AI 标注问题，人工决定是否采纳
const reviewWorkflow = {
  aiFirstPass: {
    autoApply: false,
    generateSuggestions: true,
    // AI 只生成建议，不直接修改代码
  },
  humanReview: {
    showAIInsights: true,
    showConfidenceScore: true,
    // 低置信度的建议折叠显示，高置信度的高亮
    collapseLowConfidence: true,
  },
};
```

## 小结

- AI 审查应该分模式：小改自动过，大改深度分析
- 好的审查 prompt 比好的审查工具更重要，要针对不同维度写专用 prompt
- CI 集成时 AI 做初筛，人工做终审，不要反过来
- AI 审查最大的价值是"减少人看垃圾信息的时间"，而不是替代人的判断
- 始终保持一个信念：AI 会遗漏，人是最终的质量守门员
