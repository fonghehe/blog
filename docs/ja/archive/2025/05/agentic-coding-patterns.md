---
title: "Agentic Coding：AIエージェント駆動のコーディングパターン"
date: 2025-05-03 10:00:00
tags:
  - エンジニアリング
readingTime: 2
description: "2025年の最大の変化の一つは、Agentic Codingの成熟です。AIはもはやコードを補完するだけのツールではなく、複雑なタスクを自律的に完成させるエージェントになりました。実践的なパターンを紹介します。"
wordCount: 265
---

2025年の最大の変化の一つは、Agentic Codingの成熟です。AIはもはやコードを補完するだけのツールではなく、複雑なタスクを自律的に完成させるエージェントになりました。実践的なパターンを紹介します。

## AgenticとAI補助の違い

```
従来のAI補助（2023-2024）：
  - Tab補完：1行書いたらAIが1行補完
  - Chatダイアログ：質問すればAIが回答
  - 人間主導、AIがサポート

Agentic Coding（2025）：
  - AIエージェントがプロジェクト全体のコンテキストを理解
  - 複数ステップのタスクを自律的に計画
  - ツール（ターミナル、ファイルシステム、ブラウザ）を呼び出せる
  - 人間が目標を設定し、AIが実行＋人間がレビュー
```

## パターン1：Spec-Driven Development

```markdown
# タスク：ユーザーお気に入り機能の実装

## 要件

ユーザーが商品詳細ページで商品をお気に入り登録し、マイページでお気に入り一覧を閲覧できる。

## データモデル

- Favoriteテーブル：id, userId, productId, createdAt
- ProductとUserテーブルと関連付け

## API

- POST /api/favorites - お気に入り追加
- DELETE /api/favorites/:id - お気に入り解除
- GET /api/favorites - お気に入り一覧取得

## フロントエンド

- ProductDetailページにお気に入りボタンを追加
- Favoritesページでお気に入り一覧を表示
- Optimistic UIを使用

## 制約

- 1ユーザーあたり最大100件
- 未ログイン時はログインへ誘導
```

```bash
# Claude Codeで実行
claude "SPEC.mdに従ってユーザーお気に入り機能を実装してください"
# エージェントが以下を行う：
# 1. DBマイグレーション作成
# 2. APIルート実装
# 3. フロントエンドコンポーネント作成
# 4. テスト作成
# 5. ドキュメント更新
```

## パターン2：Agent TDD

```bash
# 先にテストを書いて、エージェントに機能を実装させる

# 1. 人間がテストケースを書く
cat > tests/search.test.ts << 'EOF'
import { describe, it, expect } from "vitest";
import { search } from "../lib/search";

describe("search", () => {
  it("should find exact match", () => {
    const results = search([{ name: "iPhone" }], "iPhone");
    expect(results).toHaveLength(1);
  });

  it("should support fuzzy search", () => {
    const results = search([{ name: "iPhone 15" }], "ipone");
    expect(results).toHaveLength(1);
  });

  it("should highlight match keywords", () => {
    const results = search([{ name: "iPhone 15 Pro" }], "iPhone");
    expect(results[0].highlight).toBe("<mark>iPhone</mark> 15 Pro");
  });

  it("should rank by relevance", () => {
    const items = [
      { name: "iPhone 15 Pro Max" },
      { name: "iPhone 15" },
      { name: "iPhone Case" },
    ];
    const results = search(items, "iPhone 15");
    expect(results[0].name).toBe("iPhone 15");
  });
});
EOF

# 2. 全テストが通るまでエージェントに実装させる
claude "lib/search.tsを実装して、tests/search.test.tsの全テストをパスさせてください"
```

## パターン3：Refactoring Agent

```bash
# 大規模リファクタリングタスク

# 1. クラスコンポーネントを関数コンポーネントに移行
claude "src/components/配下のすべてのクラスコンポーネントを関数コンポーネント＋hooksに移行してください。
       propsのインターフェースは変更しないこと、機能も変えないこと"

# 2. ReduxからZustandへ移行
claude "src/store/をReduxからZustandに移行してください。
       すべてのactionとselectorのAPIは変えないこと"

# 3. CSS ModulesからTailwindへ移行
claude "src/styles/のCSS ModulesをTailwind CSSに移行し、
       コンポーネントのclassNameに直接記述してください"
```

## パターン4：Bug Fix Agent

```bash
# バグを再現させてからエージェントに修正させる

# 1. エラー情報を提供する
claude "以下のエラーを修正してください：
  TypeError: Cannot read properties of undefined (reading 'map')
  at ProductList (src/components/ProductList.tsx:15)

  再現手順：
  1. /productsにアクセス
  2. ネットワークリクエストが失敗するとページがクラッシュ
  3. 期待：空の状態を表示、クラッシュしないこと"

# エージェントが行うこと：
# 1. ProductList.tsx:15を特定
# 2. productsがundefinedになる可能性を発見
# 3. loadingとerror状態の処理を追加
# 4. error boundaryの追加も提案するかもしれない
```

## パターン5：Migration Agent

```bash
# 依存関係のアップグレード

# Next.js 14 → 15
claude "プロジェクトをNext.js 14から15へアップグレードしてください。
       すべてのbreaking changesを対応し、
       テストを実行して機能が変わらないことを確認してください"

# React 18 → 19
claude "プロジェクトをReact 18から19へアップグレードしてください。
       forwardRefを直接ref propに変更し、
       useFormStateをuseActionStateに変更してください"

# Tailwind 3 → 4
claude "プロジェクトをTailwind CSS 3から4へアップグレードしてください。
       tailwind.config.jsをCSS @themeブロックに移行してください"
```

## エージェントの限界

```
エージェントが得意なこと：
  ✓ 明確な仕様がある繰り返し作業
  ✓ コードの移行とリファクタリング
  ✓ テスト生成
  ✓ バグ修正（明確なエラー情報がある場合）
  ✓ ドキュメント生成

エージェントが苦手なこと：
  ✗ 深いビジネス理解が必要な意思決定
  ✗ パフォーマンス最適化（実際のデータ分析が必要）
  ✗ アーキテクチャ設計（先見性が必要）
  ✗ セキュリティ重要コード（認証、暗号化）
  ✗ 創造的なUI/UXデザイン
```

## まとめ

- Agentic Codingは2025年で最も重要な開発パターンの変化
- Spec-Driven Developmentにより開発フローがより構造化される
- TDD＋エージェントは高品質なコードの保証
- エージェントは移行・リファクタリング・テスト生成が得意、ビジネスイノベーションは苦手
- 人間の役割が「コードを書く」から「要件を定義してコードをレビューする」に変化
