---
title: "CSS コンテナクエリ 2026 実践：コンポーネントレベルのレスポンシブデザイン"
date: 2026-06-04 16:38:53
tags:
  - CSS
readingTime: 3
description: "コンテナクエリはコンポーネントが自身のコンテナサイズに基づいてレイアウトを調整することを可能にし、ビューポート幅に依存しない。2026 年のコンテナクエリの実践的用法、よくある陷阱、Grid と Flex との戦略を議論する。"
wordCount: 726
---

CSS コンテナクエリはレスポンシブデザインにおけるパラダイム転換だ。従来のメディアクエリはビューポート幅に基づいているが、コンポーネントは実際の使用において自身がどの幅のコンテナに配置されるかを知らないことが多い。コンテナクエリはこの問題を解決する——コンポーネントが「自分自身の環境」に基づいてスタイルを調整できるようにする。

## 基本構文

コンテナクエリのコアは 2 つのプロパティ：`container-type` と `@container` だ：

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

`container-type` は 3 つの値を持つ：
- `inline-size`：インライン方向のサイズ変化のみ監視（最も一般的）
- `size`：インラインとブロックの両方向を監視
- `normal`：コンテナクエリのターゲットにならない

## コンテナクエリ vs メディアクエリ

| シナリオ | 推奨手法 | 理由 |
|----------|----------|------|
| ページ全体のレイアウト | メディアクエリ | ビューポート幅がレイアウトを決定 |
| カードコンポーネント | コンテナクエリ | カードは異なるコンテナで幅が異なる |
| ナビゲーションバー | メディアクエリ | 通常ビューポート幅で制御 |
| フォームコンポーネント | コンテナクエリ | フォームはサイドバーまたはメインコンテンツにあり得る |

原則：**コンポーネントが環境に適応する必要がある → コンテナクエリ；ページ全体のレイアウト → メディアクエリ**

## 実際のケース：アダプティブカード

```css
.card-wrapper {
  container-type: inline-size;
}

/* 狭いコンテナ：垂直レイアウト */
@container (max-width: 300px) {
  .card { flex-direction: column; }
}

/* 中程度のコンテナ：水平レイアウト */
@container (min-width: 301px) and (max-width: 600px) {
  .card { flex-direction: row; }
  .card-image { width: 120px; flex-shrink: 0; }
}

/* 広いコンテナ：水平レイアウト、大きな画像 */
@container (min-width: 601px) {
  .card { flex-direction: row; }
  .card-image { width: 200px; flex-shrink: 0; }
}
```

## コンテナクエリ単位

```css
.card-title {
  font-size: clamp(1rem, 3cqi, 1.5rem);
}
```

単位一覧：
- `cqw`：コンテナ幅の 1%
- `cqh`：コンテナ高さの 1%
- `cqi`：コンテナインラインサイズの 1%
- `cqb`：コンテナブロックサイズの 1%
- `cqmin`：cqi と cqb の小さい方
- `cqmax`：cqi と cqb の大きい方

## よくある陷阱

**陷阱 1：container-type の設定を忘れる**

```css
/* エラー：コンテナタイプが宣言されていない */
.sidebar { width: 300px; }

@container (min-width: 400px) {
  .sidebar .widget { /* このルールは機能しない */ }
}
```

## 段階的エンハンス戦略

```css
/* ベーススタイル（コンテナクエリに依存しない） */
.card { display: flex; flex-direction: column; }

/* コンテナクエリエンハンス */
@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## まとめ

コンテナクエリはコンポーネントに真の「自己適応」を可能にし、ビューポート幅に依存しなくなる。これはレスポンシブデザインの最後のピース——ページレイアウトはメディアクエリ、コンポーネント内部はコンテナクエリを使用する。Grid と Flex と組み合わせることで、真に柔軟なコンポーネントシステムを構築できる。
