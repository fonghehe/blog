---
title: "Agentic Code Review：AI 驱动的代码审查"
date: 2025-06-22 10:00:00
tags:
  - 工程化
---

团队引入 AI agent 做代码审查已经半年了。不是简单的 lint 规则，而是能理解业务逻辑的深度 review。来分享实战经验。

## 什么是 Agentic Code Review

```
传统 lint：检查语法、格式、已知规则
AI Review：理解代码意图、发现逻辑问题、建议架构改进

Agentic = AI agent 能自主地：
  1. 读取相关代码上下文
  2. 调用工具获取更多信息
  3. 做出多步推理
  4. 生成结构化的 review 意见
```

## 实现方案

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

async function reviewPR(diff: string, context: string): Promise<ReviewResult[]> {
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

## CI 集成

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

## 审查规则示例

```tsx
// AI 能发现的典型问题：

// 1. 内存泄漏
function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // 问题：没有 cleanup，组件卸载后还在更新状态
    fetch("/api/data").then((r) => r.json()).then(setData);
  }, []);
}

// AI 建议：
// "useEffect 中的异步操作需要 cleanup，
//  使用 AbortController 取消请求"

// 2. 性能问题
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

// AI 建议：
// "onClick 每次渲染都创建新函数，
//  如果 UserCard 使用了 memo，会导致不必要的重渲染"

// 3. 类型安全
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json(); // 问题：any 类型
  return data; // 缺少返回类型
}

// AI 建议：
// "添加返回类型 User，使用 zod 或 io-ts 验证响应"
```

## 审查效果

```
3 个月跟踪数据：
  AI 发现的问题：847 个
  人类确认有效：623 个（73.5%）
  误报：224 个（26.5%）

  最高效类别：
    1. TypeScript 类型问题（有效率 92%）
    2. 安全漏洞（有效率 88%）
    3. 性能问题（有效率 75%）
    4. 代码风格（有效率 70%）
    5. 架构建议（有效率 55%）

  人类补充的审查：
    AI 未发现但人类发现的问题占比 15%
    （主要是业务逻辑和需求理解问题）
```

## 小结

- Agentic Code Review 不是替代人类审查，是第一道筛选
- AI 擅长发现技术问题（类型、安全、性能），不擅长业务逻辑
- 设置合理的 severity 阈值，避免 review 噪声太多
- 把 AI review 意见作为 PR comment 的参考，最终决定权在人类
- 持续优化 prompt，减少误报率
