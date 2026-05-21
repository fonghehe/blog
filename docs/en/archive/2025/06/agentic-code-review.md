---
title: "Agentic Code Review: AI-Driven Code Reviews"
date: 2025-06-22 10:00:00
tags:
  - Engineering
readingTime: 2
description: "Our team has been using AI agents for code review for six months. Not simple lint rules, but deep reviews that understand business logic. Here's the experience "
wordCount: 100
---

Our team has been using AI agents for code review for six months. Not simple lint rules, but deep reviews that understand business logic. Here's the experience we've gathered.

## What is Agentic Code Review

```
Traditional lint: checks syntax, formatting, known rules
AI Review: understands code intent, finds logic issues, suggests architectural improvements

Agentic = AI agent autonomously:
  1. Reads relevant code context
  2. Calls tools to gather more information
  3. Performs multi-step reasoning
  4. Generates structured review comments
```

## Implementation

```ts
// scripts/ai-review.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface ReviewResult {
  file: string;
  line: number;
  severity: "error" | "warning" | "suggestion";
  category: string;
  message: string;
  suggestion?: string;
}

async function reviewPR(
  diff: string,
  context: string,
): Promise<ReviewResult[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `你是一个资深前端工程师，负责代码审查。
审查维度：
1. 正确性：逻辑错误、边界条件
2. 安全性：XSS、CSRF、数据泄露
3. 性能：不必要的重渲染、大列表、内存泄漏
4. 可维护性：命名、抽象、耦合度
5. TypeScript：类型安全、any 使用

输出格式：JSON 数组，每个元素包含 file, line, severity, category, message, suggestion`,
    messages: [
      {
        role: "user",
        content: `请审查以下代码变更：

## 上下文（相关文件）
${context}

## Diff
${diff}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type === "text") {
    return JSON.parse(content.text);
  }
  return [];
}
```

## CI Integration

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  pull-requests: write

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get changed files
        id: changes
        run: |
          DIFF=$(git diff origin/${{ github.base_ref }}...HEAD)
          echo "diff<<EOF" >> $GITHUB_OUTPUT
          echo "$DIFF" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - name: Run AI Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx scripts/ai-review.ts

      - name: Post Review Comments
        uses: actions/github-script@v7
        with:
          script: |
            const review = require('./review-results.json');
            for (const item of review) {
              await github.rest.pulls.createReviewComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.issue.number,
                body: `**[${item.severity.toUpperCase()}]** ${item.message}\n\n${item.suggestion || ''}`,
                commit_id: context.payload.pull_request.head.sha,
                path: item.file,
                line: item.line,
              });
            }
```

## Review Rule Examples

```tsx
// Typical issues AI can catch:

// 1. Memory leak
function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // 问题：没有 cleanup，组件卸载后还在更新状态
    fetch("/api/data")
      .then((r) => r.json())
      .then(setData);
  }, []);
}

// AI suggestion:
// "Async operations in useEffect need a cleanup.
//  Use AbortController to cancel the request."

// 2. Performance issue
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map((user) => (
        // 问题：每次渲染都创建新的函数
        <UserCard
          key={user.id}
          user={user}
          onClick={() => navigate(`/users/${user.id}`)}
        />
      ))}
    </div>
  );
}

// AI suggestion:
// "onClick creates a new function on every render.
//  If UserCard uses memo, this will cause unnecessary re-renders."

// 3. Type safety
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json(); // 问题：any 类型
  return data; // 缺少返回类型
}

// AI suggestion:
// "Add return type User, validate the response with zod or io-ts."
```

## Review Effectiveness

```
3-month tracking data:
  Issues found by AI:        847
  Confirmed valid by humans: 623 (73.5%)
  False positives:           224 (26.5%)

  Most effective categories:
    1. TypeScript type issues    (92% valid)
    2. Security vulnerabilities  (88% valid)
    3. Performance issues        (75% valid)
    4. Code style                (70% valid)
    5. Architecture suggestions  (55% valid)

  Human supplemental reviews:
    Issues caught by humans but missed by AI: 15%
    (mainly business logic and requirement understanding)
```

## Summary

- Agentic Code Review doesn't replace human review; it's the first filter
- AI excels at finding technical issues (types, security, performance); not good at business logic
- Set reasonable severity thresholds to avoid too much review noise
- Use AI review comments as a reference in PR; humans have the final say
- Continuously refine prompts to reduce false positive rates
