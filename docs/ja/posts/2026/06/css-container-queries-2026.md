---
title: "CSS コンテナクエリ 2026 実践：レスポンシブコンポーネント設計の新しいパラダイム"
date: 2026-06-05 11:34:38
tags:
  - CSS
readingTime: 3
description: "コンテナクエリは 2026 年のレスポンシブデザインの主流手法となっている。基本構文から複雑なレイアウトまで、実践プロジェクトでの応用パターンとベストプラクティスを体系的に解説する。"
wordCount: 836
---

レスポンシブデザインがメディアクエリからコンテナクエリへ移行することは、CSS 開発における重要な転換点だ。2026 年、コンテナクエリのブラウザサポート率は 95% を超え、実際のプロジェクトでの応用もますます成熟している。コンテナクエリのコア価値と応用パターンを理解することは、モダンフロントエンド開発者の必須スキルになった。

## メディアクエリからコンテナクエリへ

従来のメディアクエリの問題は、ビューポートのサイズしか感知できず、コンポーネント自身の利用可能スペースを感知できないことだ：

```css
/* メディアクエリ：ビューポートに基づく */
@media (min-width: 768px) {
  .card { display: grid; grid-template-columns: 200px 1fr; }
}

/* 問題：サイドバーが折りたたまれるとメインコンテンツエリアが狭くなるが、ビューポートは変化しない */
```

コンテナクエリはこの問題を解決する——コンポーネントが自身のコンテナサイズに基づいてレイアウトを調整できる：

```css
/* コンテナクエリ：親コンテナに基づく */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

## 基本構文の詳細

### コンテナタイプ

`container-type` には 3 つの値がある：

```css
/* inline-size：水平サイズのみ監視（最も一般的） */
.sidebar { container-type: inline-size; }

/* size：水平と垂直の両方を監視 */
.chart-container { container-type: size; }

/* normal：通常要素、コンテナではない */
.normal-element { container-type: normal; }
```

### 命名コンテナ

ページに複数のコンテナがある場合、命名コンテナがクエリ衝突を回避できる：

```css
.page-header { container-type: inline-size; container-name: header; }
.main-content { container-type: inline-size; container-name: content; }

@container header (min-width: 600px) {
  .nav-items { display: flex; gap: 1rem; }
}
```

## 実践的な応用パターン

### カードコンポーネントのレスポンシブ

典型的なカードコンポーネントはコンテナの幅に応じてレイアウトを調整する必要がある：

```css
.card-wrapper {
  container-type: inline-size;
}

/* 小さいコンテナ：垂直レイアウト */
@container (max-width: 399px) {
  .card { grid-template-columns: 1fr; }
}

/* 中程度のコンテナ：水平レイアウト */
@container (400px <= width <= 699px) {
  .card { grid-template-columns: 150px 1fr; }
}

/* 大きいコンテナ：水平レイアウト、大きな画像 */
@container (min-width: 700px) {
  .card { grid-template-columns: 250px 1fr; }
}
```

### ナビゲーションバーのレスポンシブ

```css
.navbar {
  container-type: inline-size;
  container-name: nav;
}

/* 広いコンテナ：完全なナビゲーション */
@container nav (min-width: 768px) {
  .nav-toggle { display: none; }
}

/* 狭いコンテナ：ハンバーガーメニュー */
@container nav (max-width: 767px) {
  .nav-items {
    position: fixed;
    left: -100%;
    transition: left 0.3s ease;
  }
  .nav-items.open { left: 0; }
  .nav-toggle { display: block; }
}
```

## パフォーマンスの最適化

コンテナクエリのパフォーマンスは通常問題ないが、複雑なレイアウトでは以下に注意する必要がある：

1. **過度なネストを避ける**：すでに小さいコンテナにコンテナクエリを定義しない
2. **コンテナタイプを適切に選択**：ほとんどの場合 `inline-size` で十分
3. **`contain` プロパティの使用**：コンテナ要素に `contain: layout style` を追加すると、レンダリングパフォーマンスが最適化できる

## まとめ

コンテナクエリは CSS レスポンシブデザインの未来の方向性だ。コンポーネントに真の「自己認識」能力を与え、ビューポートサイズではなく自身の利用可能スペースに基づいてレイアウトを調整できる。実際のプロジェクトでは、サイドバーレイアウト、カードコンポーネント、ナビゲーションバー、データテーブルなどの処理に特に適している。コンテナクエリをマスターする鍵は、「コンポーネント駆動」のレスポンシブ思考を理解すること——「ビューポートがどれくらいの幅か」ではなく「このコンポーネントにどれくらいのスペースがあるか」を考えることだ。
