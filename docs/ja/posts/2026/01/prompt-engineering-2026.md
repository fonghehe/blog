---
title: "プロンプトエンジニアリング 2026 フロントエンドベストプラクティス"
date: 2026-01-21 10:00:00
tags:
  - フロントエンド
readingTime: 4
description: "プロンプトエンジニアリングは2026年においてもフロントエンドエンジニアに必要なコアスキルです。モデルはどんどん強くなっていますが、「上手く質問できる」と「できない」の差はむしろ広がっています。良いプロンプトは一発で使えるコードを出力し、悪いプロンプトは30分の対話を無駄にします。"
wordCount: 681
---

プロンプトエンジニアリングは2026年においてもフロントエンドエンジニアに必要なコアスキルです。モデルはどんどん強くなっていますが、「上手く質問できる」と「できない」の差はむしろ広がっています。良いプロンプトは一発で使えるコードを出力し、悪いプロンプトは30分の対話を無駄にします。

## フロントエンドプロンプトの黄金構造

大量の実践を経て、フロントエンドのシナリオで最も効果的なプロンプト構造を見出しました：役割設定＋制約条件＋入出力フォーマット＋アンチパターン排除です。

```typescript
// prompt-templates.ts —— 私たちのチームのプロンプトテンプレートライブラリ
export const promptTemplates = {
  // コンポーネント開発プロンプト
  component: (spec: ComponentSpec) => `
あなたはシニアReactフロントエンドエンジニアで、以下の規約を厳守します：

技術スタック：React 20 + TypeScript 7 + Tailwind CSS v4
コンポーネントパターン：Server Componentを優先し、クライアントインタラクションが必要な場合のみ'use client'を使用
状態管理：ローカル状態はuseState/useReducer、グローバル状態はZustand
エラーハンドリング：すべての非同期操作にerror boundaryのフォールバックが必要

要件：
- コンポーネント名：${spec.name}
- 機能：${spec.description}
- Propsインターフェース：${JSON.stringify(spec.props, null, 2)}
- 必須カバー状態：loading, error, empty, success
- 必須アクセシビリティ：キーボードナビゲーション、ARIAラベル、フォーカス管理

やってはいけないこと：
- any型を使わない
- 同期的に計算できる派生状態にuseEffectを使わない
- インラインstyleを使わない——Tailwindクラス名を使う
- default exportを使わない——named exportを使う
  `,

  // パフォーマンス最適化プロンプト
  performance: (component: string) => `
以下のコンポーネントのパフォーマンス問題を分析し、最適化案を提示してください。

分析の観点：
1. レンダリングパフォーマンス：不要な再レンダリング、memoizationの不足
2. バンドルサイズ：代替可能な重いライブラリ、未使用のインポート
3. ランタイム効率：ループ内のオブジェクト生成、クロージャの罠
4. ネットワークパフォーマンス：ウォーターフォールリクエスト、プリロードの不足

出力フォーマット：
- 各問題の深刻度を明記（critical/high/medium/low）
- 最適化前後のコード比較を提示
- 最適化効果を推定（削減されるレンダリング回数、バンドルサイズの削減量）

${component}
  `,
};
```

## コンテキスト注入：AIにプロジェクトを理解させる

汎用的なプロンプトは汎用的なコードしか生成しません。AIにプロジェクトのコンテキストを理解させることが、使えるコードを出力するための前提条件です。私のアプローチはproject-context.mdファイルを維持し、毎回の対話に注入することです。

```markdown
<!-- project-context.md —— 毎回のAI対話に注入するプロジェクトコンテキスト -->

## プロジェクト情報

- フレームワーク：Next.js 15.1, React 20.2, TypeScript 7.0
- スタイリング：Tailwind CSS v4.1 + shadcn/ui
- 状態管理：Zustand 5.x + TanStack Query v5
- テスト：Vitest 3.x + Testing Library + Playwright
- パッケージ管理：Bun 3.2
- デプロイ：Vercel (Edge Runtime)

## コーディング規約

- コンポーネントはPascalCase、ファイルはkebab-case
- HookはuseではじまりhooksディレクトリとI配置する
- API呼び出しはapiディレクトリに統一的にカプセル化し、カスタムfetchラッパーを使用する
- 型定義はtypesディレクトリに優先的に配置し、コンポーネント内の型は3行を超えない
- anyは禁止、@ts-ignoreは禁止、必要な場合は@ts-expect-errorを使用する

## ディレクトリ構造

src/
app/ # App Routerのページ
components/ # 共有コンポーネント
ui/ # ベースUIコンポーネント（shadcn）
features/ # ビジネスコンポーネント
hooks/ # カスタムHooks
stores/ # Zustand stores
api/ # API呼び出し層
types/ # 共有型
utils/ # ユーティリティ関数
```

```typescript
// context-loader.ts —— プロジェクトコンテキストを自動注入するツール
import { readFileSync } from "fs";
import { glob } from "glob";

export async function buildProjectContext(): Promise<string> {
  // ベースコンテキストを読み込む
  const baseContext = readFileSync("project-context.md", "utf-8");

  // 最近変更されたファイルを自動スキャンして現在の開発方向を把握する
  const recentFiles = await glob("src/**/*.{ts,tsx}", {
    ignore: ["**/*.test.*", "**/node_modules/**"],
  });

  // package.jsonを読み込んで依存関係情報を取得する
  const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

  return `
${baseContext}

## 現在の依存関係バージョン
${Object.entries(pkg.dependencies ?? {})
  .map(([name, version]) => `- ${name}: ${version}`)
  .join("\n")}
  `;
}
```

## Chain-of-Thought：複雑なタスクの分解戦略

複雑な機能は一度に生成させるべきではありません。Chain-of-Thought戦略を使って、AIを段階的に考えるよう導きましょう。

```typescript
// 複雑なタスクのプロンプトチェーン
const cotSteps = [
  {
    step: 1,
    prompt: `
まずコードを書かないでください。この機能にはどんなデータ構造とインターフェースが必要かを分析してください。
すべてのTypeScript型定義を列挙してください。
    `,
    output: "types/",
  },
  {
    step: 2,
    prompt: `
上記の型定義に基づいて、データ取得層を実装してください。
API呼び出し関数とTanStack Query hooksを含めてください。
    `,
    output: "api/ + hooks/",
  },
  {
    step: 3,
    prompt: `
上記のhooksに基づいて、UIコンポーネントを実装してください。
最も小さなアトミックコンポーネントから始め、ページレベルのコンポーネントへと積み上げていってください。
    `,
    output: "components/",
  },
  {
    step: 4,
    prompt: `
上記のhooksとコンポーネントのテストを書いてください。
コアなビジネスロジックとエッジケースのカバレッジを優先してください。
    `,
    output: "__tests__/",
  },
];

// 実際の例：検索機能を構築する
async function buildSearchFeature() {
  // ステップ1：型定義
  await askAI(
    cotSteps[0].prompt +
      `
検索機能の要件：
- 全文検索：商品名、説明、タグをサポート
- フィルター：価格帯、カテゴリー、評価、在庫状況
- ソート：関連性、価格昇順/降順、売上、新着順
- ページネーション：カーソルベース、1ページ20件
  `,
  );

  // ステップ2〜4を順次実行...
}
```

## Few-Shot例：最も過小評価されているプロンプトテクニック

Few-shotとは、プロンプトに1〜2つの例を提供し、期待する出力フォーマットと品質をAIに伝えることです。これはAIの出力品質を向上させる最も直接的な方法です。

```typescript
// few-shot-prompt.ts
const fewShotExample = `
以下の例のコードスタイルと品質基準を参考にしてください：

// 例：useDebouce hookの実装
import { useEffect, useState, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// この例のポイント：
// 1. ジェネリックパラメータで型安全性を保証
// 2. useEffectで正しくタイマーをクリーンアップ
// 3. 依存配列が正確——多くも少なくもない
// 4. 命名が明確で、コメントなしで理解できる
// 5. 関数シグネチャが簡潔で、余分なパラメータなし

同じコードスタイルでuseThrottleフックを実装してください。
`;
```

## まとめ

- 良いフロントエンドプロンプト = 役割＋制約＋フォーマット＋アンチパターン。どれ一つ欠いてもいけない
- プロジェクトコンテキストの注入が、AIが使えるコードを出力するための前提条件
- 複雑なタスクはChain-of-Thoughtで段階的に誘導する。一発で結果を期待しない
- Few-shot例は出力品質を向上させる最も直接的なテクニック。例ライブラリの整備に時間を投資する価値がある
- プロンプトテンプレートはコードと同様にバージョン管理に組み込み、チームで共有・改善する
