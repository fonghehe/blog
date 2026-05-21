---
title: "LLM駆動のUI自動生成"
date: 2026-01-06 10:00:00
tags:
  - エンジニアリング
readingTime: 5
description: "Figmaのデザインからコードへのステップはかつてフロントエンドでも最も時間のかかる部分の一つでした。2026年、LLM駆動のUI生成ツールは、デザインの意図、コンポーネント階層、さらにはインタラクション状態まで理解できるレベルに成熟しています。しかし「動く」と「プロダクション投入できる」の間には依然として大きなギャッ"
wordCount: 873
---

Figmaのデザインからコードへのステップはかつてフロントエンドでも最も時間のかかる部分の一つでした。2026年、LLM駆動のUI生成ツールは、デザインの意図、コンポーネント階層、さらにはインタラクション状態まで理解できるレベルに成熟しています。しかし「動く」と「プロダクション投入できる」の間には依然として大きなギャップがあります。

## デザインからコードへ：現在のツールチェーン比較

市場に出回っている主要な三つのアプローチにはそれぞれ利点と欠点があります。v0.devは素早いプロトタイピングに適し、Claude Artifactsは複雑なインタラクティブコンポーネントに優れ、GitHub Copilot Workspaceは既存プロジェクトとの統合に最適です。

```tsx
// シナリオ：自然言語の説明から完全なDashboardレイアウトを生成
// 入力：「左サイドバーナビゲーション、上部に検索＋通知バー、
//       メインエリアに4つのデータカード、折れ線グラフ、データテーブルを含む
//       SaaSデータダッシュボードを作成して」

// v0.devが生成したコード（簡略版）
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardProps {
  metrics: Array<{ label: string; value: string; change: number }>;
  chartData: Array<{ date: string; revenue: number; users: number }>;
}

export function DashboardLayout({ metrics, chartData }: DashboardProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
      {metrics.map((m) => (
        <Card key={m.label}>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {m.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.value}</div>
            <span className={m.change >= 0 ? "text-green-500" : "text-red-500"}>
              {m.change >= 0 ? "+" : ""}
              {m.change}%
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## コンポーネントライブラリ対応の生成戦略

素のHTMLを生成しても意味がありません。高度なアプローチは、LLMにコンポーネントライブラリのAPIを理解させ、既存コンポーネントを直接使用するコードを生成させることです。モデルにコンポーネントのドキュメントと使用例を提供することが鍵です。

```typescript
// llm-ui-config.ts —— コンポーネントライブラリ対応の設定
export const componentAwareConfig = {
  // コンポーネントライブラリのprops定義をコンテキストとして注入する
  componentDocs: {
    source: "./src/components/ui",
    format: "extracted-props",
    // 各コンポーネントのprops型、スロット、バリアントを抽出する
    extractors: ["typescript-docs", "storybook-meta"],
  },

  // 生成時の制約
  constraints: {
    // 既存コンポーネントのみ使用する。素のHTMLは生成しない
    allowedElements: ["from-component-library"],
    // スタイリングアプローチの制限
    styling: "tailwind-only",
    // 必須インタラクション状態
    requiredStates: ["loading", "error", "empty", "success"],
  },

  // 生成後の検証
  postValidation: [
    "typescript-check",
    "visual-regression-compare", // デザインとのピクセルレベル比較
    "accessibility-audit",
  ],
};

// 実際の呼び出し例
async function generateUI(prompt: string) {
  const components = await loadComponentDocs(
    componentAwareConfig.componentDocs,
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "content-type": "application/json",
      "anthropic-version": "2024-10-22",
    },
    body: JSON.stringify({
      model: "claude-4.7-sonnet",
      max_tokens: 8192,
      system: `あなたはフロントエンドエンジニアです。以下のコンポーネントライブラリを使ってコードを生成してください：\n${components}`,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  return response.json();
}
```

## 生成後の品質保証パイプライン

AI生成のUIコードは最大でも60%の作業を完了したに過ぎません。残りの40%はレスポンシブ対応、アクセシビリティ、エッジケース処理、ビジネスロジックとの統合です。自動化パイプラインで問題を素早く特定できます。

```typescript
// ui-quality-pipeline.ts
import { chromium } from "playwright";
import { compareSnapshots } from "@visual-regression/core";
import { runA11yAudit } from "@axe-core/playwright";

async function validateGeneratedUI(componentPath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. TypeScriptコンパイルチェック
  const tsErrors = await runTypeCheck(componentPath);
  if (tsErrors.length > 0) {
    console.error("型エラー:", tsErrors);
    return { passed: false, errors: tsErrors };
  }

  // 2. 複数ビューポートのスクリーンショット比較
  const viewports = [
    { width: 375, height: 812, name: "mobile" },
    { width: 768, height: 1024, name: "tablet" },
    { width: 1440, height: 900, name: "desktop" },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto(`http://localhost:3000/preview/${componentPath}`);
    const screenshot = await page.screenshot();
    const diff = await compareSnapshots(
      screenshot,
      `designs/${componentPath}/${vp.name}.png`,
    );
    if (diff.percentage > 0.5) {
      console.warn(`${vp.name} 視覚的差異 ${diff.percentage}%`);
    }
  }

  // 3. アクセシビリティ監査
  const a11yResults = await runA11yAudit(page);
  if (a11yResults.violations.length > 0) {
    console.error("アクセシビリティの問題:", a11yResults.violations);
  }

  await browser.close();
}
```

## Agentでインタラクションロジックを注入する

静的なUIの生成は簡単な部分です。本当の難しさは、AIにビジネスロジックを理解させ、正しいフォームバリデーション、状態管理、データフローを生成させることです。私のアプローチは、まずAIにUIスケルトンを生成させ、次に第二段階のAgentでインタラクションロジックを注入することです。

```tsx
// 第二段階のAgent入力：
// 「上記のDashboardに以下を追加してください：カードをクリックすると詳細ドロワーが開き、
//   URLのsearch paramsで選択状態を同期し、
//   ドロワー内ではTanStack Tableで詳細データを表示する」

// Agentが生成したインタラクション層
import { useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

export function useDashboardInteraction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedMetric = searchParams.get("metric");

  const selectMetric = useCallback(
    (metricId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("metric", metricId);
        return next;
      });
      setDrawerOpen(true);
    },
    [setSearchParams],
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("metric");
      return next;
    });
  }, [setSearchParams]);

  return { selectedMetric, drawerOpen, selectMetric, closeDrawer };
}
```

## まとめ

- LLM UIの生成は「おもちゃ」から生産性ツールへと進化した。しかし「生成」は最初のステップに過ぎない
- コンポーネントライブラリ対応の生成戦略は手直し作業を大幅に削減する。鍵は構造化されたコンポーネントドキュメントを持つこと
- 生成後は型チェック、視覚的回帰テスト、アクセシビリティ監査の三つの品質ゲートを必ず通過させること
- インタラクションロジックは第二段階のAgentで注入することを推奨。分層生成の方が一発生成より信頼性が高い
- 2026年の最良ワークフロー：AIが初稿を作り、人間がブラッシュアップとビジネスロジックの統合を行う
