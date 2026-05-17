---
title: "AI支援開発ワークフロー：CopilotからClaude Codeまでの実践"
date: 2025-01-25 10:00:00
tags:
  - エンジニアリング
readingTime: 2
description: "2025年初頭、私たちのチームはAI支援開発を全面的に導入しました。GitHub CopilotからClaude Code、CursorからさまざまなAIプラグインまで、変化は想定よりも速く訪れています。実際に定着したワークフローを紹介します。"
---

2025年初頭、私たちのチームはAI支援開発を全面的に導入しました。GitHub CopilotからClaude Code、CursorからさまざまなAIプラグインまで、変化は想定よりも速く訪れています。実際に定着したワークフローを紹介します。

## ツールマトリクス

```
場面                    推奨ツール            説明
──────────────────────────────────────────────────────
日常コーディング補完    Cursor / Copilot      Tabキー補完、反復作業を削減
複雑な機能実装          Claude Code           プロジェクト全体の理解、エンドツーエンド実装
コードレビュー          Claude Code review    深度分析、単なるlintではない
アーキテクチャ設計      Claude 対話           複数ターンの会話、段階的な具体化
ドキュメント生成        Copilot / Claude      コードからドキュメントを生成
バグ調査               Cursor + Claude       問題の特定 + 修正提案
```

## ワークフロー1：Cursor + Claude Code連携

```bash
# Cursor でコーディング（リアルタイム補完）
# 複雑なタスクはClaude Codeターミナルに切り替え

# Claude Code プロジェクトレベルの操作
claude "src/utils/date.ts の日付処理をリファクタリングして、
        momentをTemporal APIに置き換え、
        すべてのエクスポート関数シグネチャを変更しないこと"
```

Cursorは行レベルの補完が得意で、Claude Codeはプロジェクト全体のコンテキストを理解した上での大規模な変更が得意です。両方を組み合わせることで最も高い効率が得られます。

## ワークフロー2：AI駆動のPRレビュー

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

## ワークフロー3：デザインからコードへ

```tsx
// Claude Code + Figma MCP のワークフロー
// 1. Figma からデザイン情報を取得
// 2. Claude がデザインに基づいてコンポーネントを生成
// 3. 人間によるレビューと調整

// 生成されたコンポーネントの例
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

## 実際の成果データ

```
チームデータ（3ヶ月間の追跡）：
  PRマージ速度：        +35%
  コード行数の産出：    +40%
  バグ密度：            -15%（AIレビューが発見を助けた）
  コードレビュー時間：  -50%
  ドキュメントカバレッジ：30% → 70%
```

## 注意事項

```
1. AIが生成したコードは必ずレビューしてからマージすること
2. 機密性の高いコード（認証、決済）はAIに送らないこと
3. プロンプトが具体的であるほど品質が高くなる
4. AIはボイラープレートコードは得意だが、ビジネスロジックの創造は苦手
5. チームのプロンプトライブラリを構築し、高品質なプロンプトを再利用する
```

## まとめ

- AI支援開発はエンジニアの代替ではなく、能力を増幅させるもの
- Cursorはリアルタイム補完、Claude Codeはプロジェクトレベルのタスクを担当—それぞれの強みがある
- AIレビューは人間が見落としがちな問題を発見できる
- 重要なのはチームに合ったAIワークフローを確立すること、やみくもにツールを積み重ねないこと
- 2025年、AIを活用できないフロントエンドエンジニアはますます後手に回るだろう
