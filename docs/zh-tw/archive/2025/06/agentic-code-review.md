---
title: "Agentic Code Review：AI 驅動的程式碼審查"
date: 2025-06-22 15:36:13
tags:
  - 工程化
readingTime: 2
description: "團隊引入 AI agent 做程式碼審查已經半年了。不是簡單的 lint 規則，而是能理解業務邏輯的深度 review。來分享實戰經驗。"
wordCount: 161
---

團隊引入 AI agent 做程式碼審查已經半年了。不是簡單的 lint 規則，而是能理解業務邏輯的深度 review。來分享實戰經驗。

## 什麼是 Agentic Code Review

```
傳統 lint：檢查語法、格式、已知規則
AI Review：理解程式碼意圖、發現邏輯問題、建議架構改進

Agentic = AI agent 能自主地：
  1. 讀取相關程式碼上下文
  2. 呼叫工具獲取更多資訊
  3. 做出多步推理
  4. 生成結構化的 review 意見
```

## 實現方案

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
    system: `你是一個資深前端工程師，負責程式碼審查。
審查維度：
1. 正確性：邏輯錯誤、邊界條件
2. 安全性：XSS、CSRF、資料洩露
3. 效能：不必要的重渲染、大列表、記憶體洩漏
4. 可維護性：命名、抽象、耦合度
5. TypeScript：型別安全、any 使用

輸出格式：JSON 陣列，每個元素包含 file, line, severity, category, message, suggestion`,
    messages: [
      {
        role: "user",
        content: `請審查以下程式碼變更：

## 上下文（相關檔案）
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

## CI 整合

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

## 審查規則示例

```tsx
// AI 能發現的典型問題：

// 1. 記憶體洩漏
function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // 問題：沒有 cleanup，元件解除安裝後還在更新狀態
    fetch("/api/data").then((r) => r.json()).then(setData);
  }, []);
}

// AI 建議：
// "useEffect 中的非同步操作需要 cleanup，
//  使用 AbortController 取消請求"

// 2. 效能問題
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map((user) => (
        // 問題：每次渲染都建立新的函式
        <UserCard
          key={user.id}
          user={user}
          onClick={() => navigate(`/users/${user.id}`)}
        />
      ))}
    </div>
  );
}

// AI 建議：
// "onClick 每次渲染都建立新函式，
//  如果 UserCard 使用了 memo，會導致不必要的重渲染"

// 3. 型別安全
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json(); // 問題：any 型別
  return data; // 缺少返回型別
}

// AI 建議：
// "新增返回型別 User，使用 zod 或 io-ts 驗證響應"
```

## 審查效果

```
3 個月跟蹤資料：
  AI 發現的問題：847 個
  人類確認有效：623 個（73.5%）
  誤報：224 個（26.5%）

  最高效類別：
    1. TypeScript 型別問題（有效率 92%）
    2. 安全漏洞（有效率 88%）
    3. 效能問題（有效率 75%）
    4. 程式碼風格（有效率 70%）
    5. 架構建議（有效率 55%）

  人類補充的審查：
    AI 未發現但人類發現的問題佔比 15%
    （主要是業務邏輯和需求理解問題）
```

## 小結

- Agentic Code Review 不是替代人類審查，是第一道篩選
- AI 擅長髮現技術問題（型別、安全、效能），不擅長業務邏輯
- 設定合理的 severity 閾值，避免 review 噪聲太多
- 把 AI review 意見作為 PR comment 的參考，最終決定權在人類
- 持續最佳化 prompt，減少誤報率
