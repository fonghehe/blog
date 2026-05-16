---
title: "AI-Assisted Development Workflow: From Copilot to Claude Code in Practice"
date: 2025-01-25 10:00:00
tags:
  - Engineering
readingTime: 2
description: "At the start of 2025, our team has fully integrated AI-assisted development. From GitHub Copilot to Claude Code, from Cursor to all kinds of AI plugins, the cha"
---

At the start of 2025, our team has fully integrated AI-assisted development. From GitHub Copilot to Claude Code, from Cursor to all kinds of AI plugins, the changes have come faster than expected. Let me share the workflows we've actually put into practice.

## Tool Matrix

```
Scenario                Recommended Tool      Notes
──────────────────────────────────────────────────────
Daily coding completion  Cursor / Copilot      Tab completion, reduces repetitive work
Complex feature impl.    Claude Code           Project-level understanding, end-to-end implementation
Code review              Claude Code review    Deep analysis, not just lint
Architecture discussion  Claude chat           Multi-turn dialogue, iterative refinement
Documentation            Copilot / Claude      Generate docs from code
Bug investigation        Cursor + Claude       Pinpoint issues + fix suggestions
```

## Workflow 1: Cursor + Claude Code Collaboration

```bash
# Code in Cursor (real-time completion)
# Switch to Claude Code terminal for complex tasks

# Claude Code project-level operations
claude "Refactor date handling in src/utils/date.ts,
        replace moment with the Temporal API,
        keep all exported function signatures unchanged"
```

Cursor excels at line-level completion; Claude Code excels at understanding the entire project context for large-scale changes. Using both together yields the highest efficiency.

## Workflow 2: AI-Driven PR Review

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

## Workflow 3: Design-to-Code

```tsx
// Claude Code + Figma MCP workflow
// 1. Fetch design information from Figma
// 2. Claude generates component code based on the design
// 3. Human review and adjustment

// Generated component example
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

## Actual Outcome Data

```
Team data (3-month tracking):
  PR merge speed:        +35%
  Lines of code output:  +40%
  Bug density:           -15% (AI review helps catch issues)
  Code review time:      -50%
  Documentation coverage: from 30% to 70%
```

## Important Notes

```
1. Always review AI-generated code before merging
2. Do not send sensitive code (auth, payments) to AI
3. The more specific the prompt, the higher the quality
4. AI excels at boilerplate code, not at business logic innovation
5. Build a team prompt library to reuse high-quality prompts
```

## Summary

- AI-assisted development doesn't replace engineers; it amplifies their capabilities
- Cursor handles real-time completion; Claude Code handles project-level tasks — each has its strengths
- AI review can catch issues that humans tend to overlook
- The key is establishing an AI workflow that fits your team, not blindly piling on tools
- In 2025, frontend engineers who don't leverage AI will be increasingly disadvantaged
