---
title: "Agentic Coding 2026 実践"
date: 2026-01-12 18:46:23
tags:
  - フロントエンド
readingTime: 4
description: "Agentic Codingはもはや概念実証の段階ではありません。2026年、Claude Code、Cursor Agent、GitHub Copilot Workspaceはすべて成熟した製品になりました。しかしAgentic Codingを真に使いこなしているチームはまだ少なく、ほとんどは「Agentを使って単一"
wordCount: 689
---

Agentic Codingはもはや概念実証の段階ではありません。2026年、Claude Code、Cursor Agent、GitHub Copilot Workspaceはすべて成熟した製品になりました。しかしAgentic Codingを真に使いこなしているチームはまだ少なく、ほとんどは「Agentを使って単一の関数を書く」段階にとどまっています。

## Agentワークフローの三層アーキテクチャ

私がまとめたAgentワークフローは三層に分かれています：タスク計画層、実行層、検証層。三つとも欠かせません——実行層だけのAgentはCopilotより少し便利な程度に過ぎません。

```typescript
// agent-workflow.ts —— 三層アーキテクチャの実装
import { createAgent } from "@anthropic-ai/claude-code";

// 第一層：タスク計画 —— 大きな目標を実行可能なステップに分解
const planner = createAgent({
  role: "planner",
  model: "claude-4.7-opus",
  systemPrompt: `あなたは技術アーキテクトです。タスクを受け取ったら：
  1. 関連するファイルとモジュールを分析する
  2. 3〜8つのアトミックなステップに分解する
  3. 各ステップに依存関係と推定複雑度を注記する
  4. 人間の確認が必要な意思決定ポイントを明記する`,
});

// 第二層：コード実行 —— ステップごとに実装する
const executor = createAgent({
  role: "executor",
  model: "claude-4.7-sonnet",
  tools: ["read", "write", "edit", "bash", "test"],
  rules: [
    "各ステップ完了後、すぐに関連テストを実行する",
    "テスト失敗時は自動修正、最大3回まで試みる",
    "3回失敗したら一時停止し、人間の介入を要請する",
  ],
});

// 第三層：検証レビュー —— 出力品質を確認する
const reviewer = createAgent({
  role: "reviewer",
  model: "claude-4.7-sonnet",
  checks: [
    "type-safety",
    "test-coverage",
    "no-console-logs",
    "no-unused-imports",
    "consistent-with-existing-patterns",
  ],
});
```

## 実践：Agentで完全な機能を実装する

実際の要件を例に取りましょう：ECプロジェクトに「商品比較」機能を追加する。この機能はページ、コンポーネント、状態管理、ルーティング、API連携を含む——典型的な中程度の複雑さのタスクです。

```typescript
// Agentへのタスク記述 —— できるだけ具体的に
const taskDescription = `
要件：商品比較機能

機能詳細：
- ユーザーは商品一覧ページで2〜4件の商品を選択して比較に追加できる
- 比較ページは選択した商品のスペックを横並びで比較する表を表示する
- 比較状態はURLのsearch paramsで永続化する
- 比較バーは下部に固定表示され、選択済み商品のサムネイルを表示する

技術上の制約：
- 既存のZustand storeパターンを使用する
- UIコンポーネントはshadcn/uiを使用する
- データ取得はTanStack Queryを使用する
- ルーティングはApp RouterのParallel Routesを使用する
`;

// Agentが実際に生成したファイル一覧
const generatedFiles = [
  "src/stores/compare-store.ts", // Zustand store
  "src/app/(shop)/compare/page.tsx", // 比較ページ
  "src/app/(shop)/compare/@specs/page.tsx", // Parallel Route: スペック比較
  "src/components/product/compare-bar.tsx", // 下部固定バー
  "src/components/product/compare-checkbox.tsx", // 商品チェックボックス
  "src/hooks/use-compare-params.ts", // URL paramsの同期
  "src/api/compare.ts", // API呼び出し
  "src/stores/__tests__/compare-store.test.ts", // Storeのテスト
  "src/components/product/__tests__/compare-bar.test.tsx", // コンポーネントテスト
];

// 主要なStoreの実装
// src/stores/compare-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompareState {
  selectedIds: string[];
  maxItems: number;
  addProduct: (id: string) => void;
  removeProduct: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      maxItems: 4,

      addProduct: (id) => {
        const { selectedIds, maxItems } = get();
        if (selectedIds.length >= maxItems || selectedIds.includes(id)) return;
        set({ selectedIds: [...selectedIds, id] });
      },

      removeProduct: (id) => {
        set({ selectedIds: get().selectedIds.filter((i) => i !== id) });
      },

      clearAll: () => set({ selectedIds: [] }),

      isSelected: (id) => get().selectedIds.includes(id),
    }),
    { name: "product-compare" },
  ),
);
```

## Agentのコンテキスト管理戦略

Agentの最大のボトルネックはコンテキストウィンドウです。プロジェクトが大きくなると、Agentはコードベース全体を「見渡せ」なくなります。実践では階層化されたコンテキスト戦略でこの問題に対処しています。

```typescript
// context-strategy.ts
const contextLayers = {
  // 第一層：プロジェクトスケルトン（常時読み込み）
  skeleton: {
    files: ["package.json", "tsconfig.json", "README.md"],
    purpose: "プロジェクト種別、依存関係、ビルド設定を把握する",
    tokens: "~2K",
  },

  // 第二層：関連モジュール（必要に応じて読み込み）
  relevant: {
    files: "auto-detect",
    purpose: "現在のタスクに直接関連するファイル",
    detection: "import-chain + same-directory + test-files",
    tokens: "~30K",
  },

  // 第三層：パターン参照（必要に応じて注入）
  patterns: {
    files: "similar-implementations",
    purpose: "プロジェクト内の類似機能の実装例、参照テンプレートとして使用",
    injection:
      "Agentが新機能を書く際、最近完成した類似ファイル2〜3件を注入する",
    tokens: "~15K",
  },

  // 第四層：ルールと規約（システムプロンプトに注入）
  conventions: {
    content: "チームのコーディング規約、Gitコミット規約、命名規則",
    tokens: "~3K",
  },
};
```

## Agentの失敗パターンと対策

Agentは万能ではありません。最も一般的な失敗パターン：ループに陥る（同じファイルを繰り返し変更する）、幻覚を起こす（存在しないAPIを参照する）、コンテキストを無視する（以前の決定を忘れる）。対策は明確なガードレールを設定することです。

```typescript
// agent-guardrails.ts
const guardrails = {
  // 無限ループを防ぐ
  maxIterationsPerFile: 3,
  maxTotalIterations: 20,

  // 破壊的な操作を防ぐ
  blockedCommands: ["rm -rf", "git push --force", "npm publish", "DROP TABLE"],

  // 幻覚を防ぐ：参照されているAPIが存在するか確認する
  validateImports: true,
  validateFunctionCalls: true,

  // チェックポイント：各ステップ完了後に状態を保存する
  checkpoints: {
    enabled: true,
    onFail: "rollback-to-last-checkpoint",
  },

  // タイムアウト制御
  timeout: {
    singleStep: 120_000, // 1ステップ最大2分
    totalTask: 600_000, // タスク全体最大10分
  },
};
```

## まとめ

- Agentic Codingの核心は三層アーキテクチャ：計画・実行・検証。Agentに一発で全部やらせようとしない
- タスクの記述は具体的であればあるほど良い。自由を与えるより制約を与える方が良いコードを生み出す
- コンテキスト管理がAgentの命運を握る。全量読み込みより階層的な注入の方が効率的
- ループ、幻覚、破壊的操作を防ぐためにガードレールを設定する
- Agentが最も力を発揮するシナリオ：中程度の複雑さで、明確な制約があり、参照できる既存パターンがあるコーディングタスク
