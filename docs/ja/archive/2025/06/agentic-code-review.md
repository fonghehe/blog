---
title: "Agentic Code Review：AIによるコードレビュー"
date: 2025-06-22 15:36:13
tags:
  - エンジニアリング
readingTime: 2
description: "チームにAIエージェントによるコードレビューを導入して半年が経ちました。単純なlintルールではなく、ビジネスロジックを理解した深いレビューです。実践経験を共有します。"
wordCount: 206
---

チームにAIエージェントによるコードレビューを導入して半年が経ちました。単純なlintルールではなく、ビジネスロジックを理解した深いレビューです。実践経験を共有します。

## Agentic Code Reviewとは

```
従来のlint：構文・フォーマット・既知のルール違反をチェック
AIレビュー：コードの意図を理解し、論理的なバグを発見し、アーキテクチャ改善を提案

Agentic = AIエージェントが自律的に：
  1. 関連するコードコンテキストを読み取る
  2. ツールを呼び出してより多くの情報を収集する
  3. 多段階の推論を行う
  4. 構造化されたレビューコメントを生成する
```

## 実装方法

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
    system: `あなたはシニアフロントエンドエンジニアで、コードレビューを担当しています。
レビューの観点：
1. 正確性：ロジックエラー、境界条件
2. セキュリティ：XSS、CSRF、データ漏洩
3. パフォーマンス：不要な再レンダリング、大きなリスト、メモリリーク
4. 保守性：命名、抽象化、結合度
5. TypeScript：型安全性、anyの使用

出力形式：JSON配列、各要素にfile、line、severity、category、message、suggestionを含む`,
    messages: [
      {
        role: "user",
        content: `以下のコード変更をレビューしてください：

## コンテキスト（関連ファイル）
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

## CI統合

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

## AIが検出する典型的な問題

```tsx
// AIが発見できる典型的な問題：

// 1. メモリリーク
function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    // 問題：クリーンアップがなく、コンポーネントがアンマウントされても状態を更新し続ける
    fetch("/api/data")
      .then((r) => r.json())
      .then(setData);
  }, []);
}

// AI提案：
// "useEffect内の非同期操作にはクリーンアップが必要です。
//  AbortControllerを使ってリクエストをキャンセルしてください"

// 2. パフォーマンス問題
function UserList({ users }: { users: User[] }) {
  return (
    <div>
      {users.map((user) => (
        // 問題：毎回レンダリングするたびに新しい関数を作成している
        <UserCard
          key={user.id}
          user={user}
          onClick={() => navigate(`/users/${user.id}`)}
        />
      ))}
    </div>
  );
}

// AI提案：
// "onClickは毎回レンダリングで新しい関数を作成します。
//  UserCardがmemoを使っている場合、不要な再レンダリングが発生します"

// 3. 型安全性
async function getUser(id: string) {
  const res = await fetch(`/api/users/${id}`);
  const data = await res.json(); // 問題：any型
  return data; // 戻り値の型が不明
}

// AI提案：
// "戻り値の型Userを追加し、zodやio-tsでレスポンスを検証してください"
```

## レビュー効果

```
3ヶ月のトラッキングデータ：
  AIが発見した問題：847件
  人間が有効と確認：623件（73.5%）
  誤検知：224件（26.5%）

  有効率が高いカテゴリ：
    1. TypeScript型の問題（有効率92%）
    2. セキュリティ脆弱性（有効率88%）
    3. パフォーマンス問題（有効率75%）
    4. コードスタイル（有効率70%）
    5. アーキテクチャ提案（有効率55%）

  AIが見逃し人間が発見した問題：15%
  （主にビジネスロジックと要件理解の問題）
```

## まとめ

- Agentic Code Reviewは人間のレビューの代替ではなく、最初のフィルタリング
- AIは技術的な問題（型・セキュリティ・パフォーマンス）が得意で、ビジネスロジックは苦手
- レビューのノイズが多くなりすぎないよう、適切なseverityの閾値を設定する
