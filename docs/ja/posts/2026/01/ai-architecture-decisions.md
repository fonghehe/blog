---
title: "AIアシスト型アーキテクチャ決定ツール"
date: 2026-01-08 10:00:00
tags:
  - エンジニアリング
readingTime: 4
description: "技術選定とアーキテクチャの意思決定は、シニアエンジニアにとって核心的な仕事であり、AIが最も代替しにくい部分でもあります。しかしAIは意思決定の強力なサポートツールになれます——トレードオフの分析、異なる方式のパフォーマンスシミュレーション、見落としていた制約条件の発見まで行えます。"
wordCount: 717
---

技術選定とアーキテクチャの意思決定は、シニアエンジニアにとって核心的な仕事であり、AIが最も代替しにくい部分でもあります。しかしAIは意思決定の強力なサポートツールになれます——トレードオフの分析、異なる方式のパフォーマンスシミュレーション、見落としていた制約条件の発見まで行えます。

## AIによる技術選定の比較分析

技術選定は、もはやカンや GitHubスター数に頼る時代ではありません。今の手法は、AIにプロジェクトの制約に基づいた構造化分析を行わせ、重みづけスコアで推薦を出させることです。

```typescript
// tech-selection.ts —— AIアシスト型技術選定フレームワーク
interface SelectionCriteria {
  factor: string;
  weight: number; // 1-10
  description: string;
}

interface TechOption {
  name: string;
  scores: Record<string, number>; // factor -> score (1-10)
}

// プロジェクトの制約を定義する
const criteria: SelectionCriteria[] = [
  {
    factor: "performance",
    weight: 9,
    description: "初期表示 < 2秒、インタラクション応答 < 100ms",
  },
  { factor: "dx", weight: 7, description: "開発体験、型安全性、HMR速度" },
  {
    factor: "ecosystem",
    weight: 8,
    description: "コミュニティ活発度、サードパーティライブラリの品質",
  },
  {
    factor: "team-familiarity",
    weight: 6,
    description: "チームの既存技術スタックとの適合度",
  },
  { factor: "hiring", weight: 5, description: "人材市場の供給状況" },
  { factor: "ai-tooling", weight: 8, description: "AIツールサポートの充実度" },
];

// AIが制約に基づいて各選択肢を評価する
function calculateWeightedScore(
  option: TechOption,
  criteria: SelectionCriteria[],
) {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  return criteria.reduce((score, c) => {
    return score + (option.scores[c.factor] * c.weight) / totalWeight;
  }, 0);
}
```

## アーキテクチャ影響分析：分割か統合か？

「マイクロフロントエンドに分割すべきか」「モノレポを採用すべきか」といった問いに標準解答はありません。AIの価値は、異なる意思決定の長期的な影響を定量化する分析を助けることにあります。

```typescript
// architecture-analysis.ts
interface ModuleAnalysis {
  path: string;
  linesOfCode: number;
  changeFrequency: number; // 月平均変更回数
  dependencyCount: number; // 何モジュールに依存されているか
  couplingScore: number; // 0-1、結合度
  teamOwner: string;
}

// AIがコードベースを分析した後に出力するモジュール関係グラフ
const moduleGraph: ModuleAnalysis[] = [
  {
    path: "src/features/auth",
    linesOfCode: 3200,
    changeFrequency: 4.2,
    dependencyCount: 23,
    couplingScore: 0.82,
    teamOwner: "platform",
  },
  {
    path: "src/features/checkout",
    linesOfCode: 8500,
    changeFrequency: 12.1,
    dependencyCount: 8,
    couplingScore: 0.35,
    teamOwner: "commerce",
  },
  {
    path: "src/features/catalog",
    linesOfCode: 6100,
    changeFrequency: 8.7,
    dependencyCount: 15,
    couplingScore: 0.61,
    teamOwner: "catalog",
  },
  {
    path: "src/shared/ui",
    linesOfCode: 4200,
    changeFrequency: 2.1,
    dependencyCount: 45,
    couplingScore: 0.12,
    teamOwner: "platform",
  },
];

// AIの分割推薦ロジック
function shouldExtractModule(mod: ModuleAnalysis): boolean {
  // 高い変更頻度 + 低い結合度 = 独立化に適している
  // 高い結合度 + 多くの依存元 = 分割コストが高く、推奨しない
  const independenceScore = (1 - mod.couplingScore) * mod.changeFrequency;
  return independenceScore > 5;
}
```

## パフォーマンスバジェットの意思決定支援

AIはユーザープロファイルとトラフィックデータに基づき、「LCP < 2.5秒」と漠然と決めるのではなく、合理的なパフォーマンスバジェットの策定を支援できます。

```typescript
// performance-budget-ai.ts
interface UserSegment {
  name: string;
  percentage: number;
  device: "high-end" | "mid-range" | "low-end";
  network: "4g" | "3g" | "slow-3g";
  region: string;
}

const userSegments: UserSegment[] = [
  {
    name: "一線都市iOS",
    percentage: 35,
    device: "high-end",
    network: "4g",
    region: "cn-east",
  },
  {
    name: "二線都市Android",
    percentage: 28,
    device: "mid-range",
    network: "4g",
    region: "cn-central",
  },
  {
    name: "地方市場",
    percentage: 22,
    device: "low-end",
    network: "3g",
    region: "cn-west",
  },
  {
    name: "海外ユーザー",
    percentage: 15,
    device: "mid-range",
    network: "4g",
    region: "sea",
  },
];

// AIがユーザーセグメントに基づいて推薦するパフォーマンスバジェット
interface PerformanceBudget {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  unit: string;
}

const aiRecommendedBudget: PerformanceBudget[] = [
  { metric: "FCP", p50: 1200, p75: 1800, p95: 3200, unit: "ms" },
  { metric: "LCP", p50: 2000, p75: 2800, p95: 4500, unit: "ms" },
  { metric: "INP", p50: 80, p75: 150, p95: 350, unit: "ms" },
  { metric: "CLS", p50: 0.02, p75: 0.08, p95: 0.18, unit: "score" },
  { metric: "JS Bundle", p50: 180, p75: 250, p95: 400, unit: "KB" },
  // 注：地方市場は22%を占めるため、p95バジェットは業界平均より保守的に設定
];
```

## AIの意思決定における一般的な落とし穴を避ける

AIの最大の問題は「もっともらしく見えるが実は間違っている」ことです。存在しないベンチマークデータを作り上げ、特定のビジネスシナリオを無視し、メンテナンスが停止したライブラリを推薦することさえあります。AIの出力は必ず別の手段で検証してください。

```typescript
// 意思決定の検証チェックリスト
const decisionValidation = {
  // AIが推薦したライブラリ/フレームワークは以下を必ず確認する
  checks: [
    {
      name: "アクティブ度の確認",
      action: 'npm info <package> --json | jq ".time.modified"',
      threshold: "直近6か月以内に更新があること",
    },
    {
      name: "セキュリティ監査",
      action: "npm audit && snyk test <package>",
      threshold: "critical/high 脆弱性がないこと",
    },
    {
      name: "互換性の確認",
      action: "ターゲットのNode/ブラウザバージョンでテストを実行",
      threshold: "CIが全グリーン",
    },
    {
      name: "チームフィードバック",
      action: "技術レビュー会議で議論し、意見を収集",
      threshold: "コアメンバーから強い反対意見がないこと",
    },
  ],
};
```

## まとめ

- AIは意思決定の加速・増幅ツールであり、意思決定者そのものではない
- 構造化された制約定義が、AIが良い提案をするための前提条件
- 定量分析（重みづけスコアリング、結合度計算）は漠然とした「AIの推薦」より信頼性が高い
- パフォーマンスバジェットは業界平均ではなく、実際のユーザーセグメントデータに基づくべき
- AIの出力は常に別途検証する——特にベンチマークデータとライブラリ推薦
