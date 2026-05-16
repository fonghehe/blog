---
title: "AI-Assisted Code Review: Hands-On Practice in an 8-Person Team"
date: 2024-02-20 17:22:08
tags:
  - Frontend
readingTime: 3
description: "作为前端平台负责人，从去年开始尝试将 AI 引入 Code Review 流程。经过几个月的实践，整理一下我们的经验和踩过的坑。"
---

作为前端平台负责人，从去年开始尝试将 AI 引入 Code Review 流程。经过几个月的实践，整理一下我们的经验和踩过的坑。

## Why AI Assistance Is Needed

我们 8 人团队每周约 40-50 个 PR，人工 review 经常成为瓶颈：

- 资深工程师时间有限，review 经常积压
- 简单问题（命名、格式、n+1 查询）占 review 时间的 60%+
- 新人代码质量波动大，需要更多关注

目标是让 AI 处理 60% 的机械性检查，人类聚焦架构和设计。

## Our Approach

### 第一层：Biome + 类型检查（零延迟）

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

### 第二层：AI Review Bot（PR 级别）

我们用 GitHub Actions + Claude API 做自动 review：

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
          # 获取 diff
          DIFF=$(gh pr diff ${{ github.event.pull_request.number }})

          # 调用 Claude API
          node scripts/ai-review.mjs "$DIFF"
```

核心 prompt 设计：

```typescript
// scripts/ai-review.mjs
const SYSTEM_PROMPT = `你是一个资深前端 Code Reviewer。请审查以下代码变更：

重点关注：
1. 潜在的运行时错误
2. 性能问题（不必要的重渲染、大列表无虚拟化）
3. 安全问题（XSS、注入、敏感信息泄露）
4. API 设计一致性
5. React/Vue 最佳实践

格式：
- 🔴 严重：必须修复
- 🟡 建议：最好修复
- 🟢 肯定：写得好的地方

不要检查：代码格式、变量命名风格（由 Biome 处理）`;
```

### 第三层：人工 Review（AI 只作为参考）

AI 的输出作为 PR 评论的第一条，人工 reviewer 可以参考但不盲从。

## Key Takeaways

### 做对了什么

**Prompt 必须具体**。早期我们用泛泛的 prompt，AI 经常输出 "代码看起来不错" 这种废话。明确指定检查项后，有效建议比例从 20% 提升到 65%。

**分离关注点**。格式检查和 lint 给 Biome，AI 专注逻辑和架构。不要让 AI 做工具能做得更好的事。

**限制上下文**。只发送 diff，不要发整个文件。既省 token，又让 AI 聚焦变更。

### 踩过的坑

**误报率初期很高**。AI 会把合理的代码标记为问题。我们做了两周的 prompt 迭代，重点是告诉 AI 项目的上下文（我们用 Vue 3 组合式 API、TypeScript strict 模式）。

**Token 消耗需控制**。大 PR 的 diff 可能很大。我们设了 500 行限制，超过的建议拆分 PR。

**不能替代架构讨论**。AI 不理解业务上下文，架构层面的决策必须人工 review。

## Results Data

经过 3 个月实践：

- PR review 平均等待时间从 4.2 小时降到 1.8 小时
- 合入前发现的问题数量增加 35%（AI 发现的 + 人工发现的）
- 生产环境 bug 率下降约 20%
- 资深工程师用于 review 的时间减少 40%

## Summary

- AI Code Review 适合处理机械性检查，不适合架构决策
- Prompt 工程是关键，需要针对团队技术栈定制
- 分层策略（lint → AI → 人工）效果最好
- 别期望 AI 替代人，而是让 AI 处理低价值工作，释放人的精力
- 持续迭代 prompt，基于实际误报率调整