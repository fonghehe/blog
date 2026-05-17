---
title: "React Compiler正式安定版：手動メモ化の終わりの始まり"
date: 2025-01-01 10:00:00
tags:
  - React
readingTime: 3
description: "React Compilerが2025年初頭に正式な安定版（Stable）に達しました。これはReactの長い歴史の中でも最も重要なDX改善の1つです——コンパイラーが自動的にコンポーネントとフックのメモ化を行うことで、開発者が`useMemo`、`useCallback`、`React.memo`を手動で書く必要がな"
---

React Compilerが2025年初頭に正式な安定版（Stable）に達しました。これはReactの長い歴史の中でも最も重要なDX改善の1つです——コンパイラーが自動的にコンポーネントとフックのメモ化を行うことで、開発者が`useMemo`、`useCallback`、`React.memo`を手動で書く必要がなくなります。

## React Compilerとは何か？

React Compilerは通常のReactコード（フック、コンポーネント）をビルド時に分析し、変更されていない計算やコンポーネントツリーのレンダリングをスキップする最適化を**自動的に挿入**するBabelプラグイン/コンパイラーです。

```bash
# 安定版のインストール
npm install -D babel-plugin-react-compiler
# または
npm install -D eslint-plugin-react-compiler
```

```javascript
// babel.config.js
module.exports = {
  plugins: [["babel-plugin-react-compiler"]],
};
```

## 手動メモ化との比較

### Before（React 18/19 スタイル）

```typescript
import { useMemo, useCallback, memo } from "react";

// 子コンポーネント：不要な再レンダリングを防ぐために memo でラップ
const ExpensiveList = memo(function ExpensiveList({
  items,
  onItemClick,
}: {
  items: Item[];
  onItemClick: (id: string) => void;
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

// 親コンポーネント
function ProductPage({ category, userId }: Props) {
  // items のフィルタリングをメモ化
  const filteredItems = useMemo(
    () => allItems.filter((item) => item.category === category),
    [category, allItems]
  );

  // コールバックをメモ化（ExpensiveList に渡すため）
  const handleItemClick = useCallback(
    (id: string) => {
      logInteraction(userId, id);
      setSelectedId(id);
    },
    [userId]
  );

  return <ExpensiveList items={filteredItems} onItemClick={handleItemClick} />;
}
```

### After（React Compiler 安定版）

```typescript
// React Compiler 有効時：memo / useMemo / useCallback を書かなくて良い
// コンパイラーが同等の最適化を自動挿入する

function ExpensiveList({
  items,
  onItemClick,
}: {
  items: Item[];
  onItemClick: (id: string) => void;
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function ProductPage({ category, userId }: Props) {
  // コンパイラーが自動で「category と allItems が変わらない限り再計算しない」最適化を挿入
  const filteredItems = allItems.filter((item) => item.category === category);

  // コンパイラーが自動で「userId が変わらない限り新しい関数を作らない」最適化を挿入
  const handleItemClick = (id: string) => {
    logInteraction(userId, id);
    setSelectedId(id);
  };

  return <ExpensiveList items={filteredItems} onItemClick={handleItemClick} />;
}
```

## コンパイラーが守るReactのルール

Compilerが正しく動作するには、コンポーネントとフックがReactのルールに従っている必要があります：

```typescript
// ✅ 正しい：純粋なレンダリング
function GoodComponent({ count }: { count: number }) {
  const doubled = count * 2; // 同じ count は必ず同じ結果
  return <div>{doubled}</div>;
}

// ❌ コンパイラーが最適化できない：副作用（レンダリング中の外部への書き込み）
let externalCount = 0;
function BadComponent({ count }: { count: number }) {
  externalCount = count; // レンダリング中に外部状態を変更している
  return <div>{count}</div>;
}

// ✅ 正しい：フックはトップレベルで呼び出す
function GoodHookUsage() {
  const [a] = useState(0);
  const [b] = useState(0);
  return <div>{a + b}</div>;
}

// ❌ コンパイラーが最適化できない：条件付きフック呼び出し
function BadHookUsage({ flag }: { flag: boolean }) {
  if (flag) {
    const [a] = useState(0); // フックをトップレベルで呼び出していない
    return <div>{a}</div>;
  }
  return null;
}
```

## ESLintプラグインで問題を早期発見

```bash
npm install -D eslint-plugin-react-compiler
```

```javascript
// .eslintrc.js
module.exports = {
  plugins: ["react-compiler"],
  rules: {
    "react-compiler/react-compiler": "error",
  },
};
```

## 既存コードへの段階的導入

```javascript
// babel.config.js — コンポーネントを選択的に有効化（段階的移行）
module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        compilationMode: "annotation", // デフォルト：all
      },
    ],
  ],
};
```

```typescript
// 'use memo' アノテーションがあるコンポーネントのみコンパイル対象
function LegacyComponent() {
  "use memo"; // このコンポーネントだけ Compiler を有効化

  const value = expensiveCalc();
  return <div>{value}</div>;
}
```

## まとめ

React Compilerの安定版リリースは、Reactコミュニティが長年取り組んできた「DX vs パフォーマンス」のトレードオフを解消する大きなマイルストーンです。新しいプロジェクトには今すぐ有効化を検討してください。既存プロジェクトには`annotation`モードで段階的に移行し、ESLintプラグインでルール違反を検出してから全面有効化することをお勧めします。
