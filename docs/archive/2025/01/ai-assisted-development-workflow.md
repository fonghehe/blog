---
title: "AI 辅助开发工作流：从 Copilot 到 Claude Code 的实践"
date: 2025-01-25 10:00:00
tags:
  - 工程化
readingTime: 2
description: "2025 年初，团队已经全面接入 AI 辅助开发。从 GitHub Copilot 到 Claude Code，从 Cursor 到各种 AI 插件，变化比想象中快。来分享一下实际落地的工作流。"
wordCount: 232
---

2025 年初，团队已经全面接入 AI 辅助开发。从 GitHub Copilot 到 Claude Code，从 Cursor 到各种 AI 插件，变化比想象中快。来分享一下实际落地的工作流。

## 工具矩阵

```
场景                    推荐工具              说明
──────────────────────────────────────────────────────
日常编码补全            Cursor / Copilot      Tab 补全，降低重复劳动
复杂功能实现            Claude Code           项目级理解，端到端实现
代码审查                Claude Code review    深度分析，不只是 lint
架构设计讨论            Claude 对话           多轮对话，逐步细化
文档生成                Copilot / Claude      根据代码生成文档
Bug 排查               Cursor + Claude       定位问题 + 修复建议
```

## 工作流 1：Cursor + Claude Code 协作

```bash
# 在 Cursor 中编码（实时补全）
# 遇到复杂任务时，切到 Claude Code 终端

# Claude Code 项目级操作
claude "重构 src/utils/date.ts 中的日期处理，
        使用 Temporal API 替代 moment，
        保持所有导出函数签名不变"
```

Cursor 擅长行级补全，Claude Code 擅长理解整个项目上下文后做大规模修改。两个配合用效率最高。

## 工作流 2：AI 驱动的 PR Review

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: AI Review
        run: |
          # 获取 diff
          DIFF=$(git diff origin/main...HEAD)

          # 调用 Claude API 做 review
          curl https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${{ secrets.ANTHROPIC_API_KEY }}" \
            -H "content-type: application/json" \
            -d '{
              "model": "claude-sonnet-4-20250514",
              "max_tokens": 4096,
              "messages": [{
                "role": "user",
                "content": "Review this diff for bugs, security issues, and best practices:\n'"$DIFF"'"
              }]
            }'
```

## 工作流 3：设计稿转代码

```tsx
// Claude Code + Figma MCP 的工作流
// 1. 从 Figma 获取设计稿信息
// 2. Claude 根据设计稿生成组件代码
// 3. 人工审核和调整

// 生成的组件示例
interface PricingCardProps {
  plan: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  onSelect: () => void;
}

export function PricingCard({
  plan,
  price,
  features,
  highlighted = false,
  onSelect,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-8",
        highlighted
          ? "border-primary bg-primary/5 shadow-lg scale-105"
          : "border-border bg-card",
      )}
    >
      <h3 className="text-lg font-semibold">{plan}</h3>
      <div className="mt-4">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-muted-foreground">/月</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-primary" />
            <span className="text-sm">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant={highlighted ? "default" : "outline"}
        onClick={onSelect}
      >
        选择方案
      </Button>
    </div>
  );
}
```

## 实际效果数据

```
团队数据（3 个月跟踪）：
  PR 合并速度：提升 35%
  代码行产出：提升 40%
  Bug 密度：下降 15%（AI review 帮助发现）
  代码审查时间：减少 50%
  文档覆盖率：从 30% 提升到 70%
```

## 注意事项

```
1. AI 生成的代码一定要 review，不要直接合并
2. 敏感代码（认证、支付）不要发送给 AI
3. Prompt 越具体，生成质量越高
4. AI 擅长样板代码，不擅长业务逻辑创新
5. 建立团队的 prompt 库，复用高质量 prompt
```

## 小结

- AI 辅助开发不是替代工程师，是放大工程师的能力
- Cursor 做实时补全，Claude Code 做项目级任务，各有优势
- AI Review 可以发现人类容易忽略的问题
- 关键是建立适合团队的 AI 工作流，而不是盲目堆工具
- 2025 年，不会用 AI 的前端工程师会越来越被动
