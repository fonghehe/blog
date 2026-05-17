---
title: "AI コードレビュー 2026 ベストプラクティス"
date: 2026-01-02 10:00:00
tags:
  - エンジニアリング
readingTime: 3
description: "AI コードレビューは「あれば嬉しい」機能からチームの標準装備へと変わった。しかし多くのチームが誤った使い方をしている ─ AI に頼りすぎてエンジニアが考えなくなるか、あるいは単なる高機能リンターとして使うだけ。本稿は3つの大規模プロジェクトで培った AI コードレビューの実践経験を共有する。"
---

AI コードレビューは「あれば嬉しい」機能からチームの標準装備へと変わった。しかし多くのチームが誤った使い方をしている ─ AI に頼りすぎてエンジニアが考えなくなるか、あるいは単なる高機能リンターとして使うだけ。本稿は3つの大規模プロジェクトで培った AI コードレビューの実践経験を共有する。

## 正しいレビューモードを選ぶ

異なるコード変更には異なるレビュー戦略が必要だ。小さな差分は自動レビュー、大きなリファクタリングは深い分析、セキュリティに関わる変更は人間+AI の共同レビューが必須。

```yaml
# .code-review.yaml — チームの AI レビュー設定
review:
  modes:
    auto:
      maxLines: 50
      maxFiles: 3
      autoApprove: true
      model: claude-4.7-haiku

    standard:
      maxLines: 300
      model: claude-4.7-sonnet
      checks:
        - code-quality
        - performance
        - type-safety
        - test-coverage

    deep:
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

## AI レビュー Prompt のベストプラクティス

AI レビューの品質は与えるコンテキストと指示に完全に依存する。良い prompt は本物のバグを捕らえ、悪い prompt は「コメントを追加しては」という雑音しか生み出さない。

```typescript
// review-prompts.ts — チームで使い込んだレビュー prompt テンプレート
export const reviewPrompts = {
  performance: `
以下のコード変更のパフォーマンス問題をレビューしてください。重点的に確認すること：
1. 不要な再レンダリング：React コンポーネントに memo/useMemo/useCallback が不足していないか
2. データ取得：N+1 クエリ、キャッシュ戦略の欠如がないか
3. Bundle への影響：新しい依存関係は既存のもので代替できないか
4. メモリリーク：クリーンアップされていない subscription、timer、observer がないか

本当に問題のある箇所のみ報告してください。コードスタイルや「コメントを追加しては」は報告不要。
問題がある場合は具体的な修正コードを提示してください。
  `,
  security: `
この変更のセキュリティをレビューしてください：
1. ユーザー入力はバリデーションとエスケープが行われているか
2. 機密データは適切に処理されているか（ログに出力しない、フロントエンドに露出しない）
3. 権限チェックが適切に行われているか
4. 新たな攻撃面が生まれていないか（SSRF、XSS 等）
  `,
};
```

## CI/CD パイプラインへの AI レビュー統合

AI レビューは人間の代わりに意思決定するのではなく、人間のために情報を絞り込むものだ。CI に統合する際の鍵は、AI に初期スクリーニングをさせ、人間が注目すべき点を強調表示させること。

```typescript
// AI は問題をトリアージする — high/critical のみ人間の対応が必要
const criticalIssues = results.issues.filter(
  (i) => i.severity === "critical" || i.severity === "high",
);

if (criticalIssues.length > 0) {
  // 自動マージをブロック
  process.exit(1);
}
```

## よくある落とし穴を避ける

最大の落とし穴は「AI が問題なしと言ったから本当に問題なし」だ。AI はビジネスロジックのエラー、コンテキスト依存の問題、チームの暗黙のルールを見落とす。私のアプローチ：AI は機械的なチェック（型安全性・パフォーマンスパターン・よくあるバグパターン）を担当し、人間はビジネスの正確性とアーキテクチャの一貫性を担当する。

```typescript
// アンチパターン：AI の提案を人間の判断なしに自動適用する
const autoApplyAISuggestions = true; // 危険！

// 正しいアプローチ：AI が問題を指摘し、人間が採用するかどうかを決める
const reviewWorkflow = {
  aiFirstPass: { autoApply: false, generateSuggestions: true },
  humanReview: { showAIInsights: true, collapseLowConfidence: true },
};
```

## まとめ

- AI レビューはモードベースであるべき：小さな変更は自動、大きな変更は深い分析
- 良いレビュー prompt は良いレビューツールより重要 ─ 次元別に専用 prompt を書く
- CI では AI が初回スクリーニング、人間が最終承認。逆にしてはいけない
- AI レビューの最大の価値は「人間がノイズを読む時間を減らすこと」であり、人間の判断を置き換えることではない
- 常に信じること：AI は見落とす。人間が最終的な品質の番人
