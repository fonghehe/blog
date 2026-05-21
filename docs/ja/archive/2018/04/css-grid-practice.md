---
title: "CSS Grid レイアウト実践"
date: 2018-04-19 10:12:47
tags:
  - CSS
readingTime: 2
description: "1 月に CSS Grid の基礎を書きました。今回は実際のプロジェクトシナリオを取り上げ、Grid が Flexbox では難しい問題をどう解決するかを見ていきます。"
wordCount: 289
---

1 月に CSS Grid の基礎を書きました。今回は実際のプロジェクトシナリオを取り上げ、Grid が Flexbox では難しい問題をどう解決するかを見ていきます。

## Grid vs Flex：使い分け

```
Flex：一次元レイアウト（行 OR 列）
Grid：二次元レイアウト（行 AND 列）

経験則：
  - ナビゲーションバー、ツールバー、1行のカード → Flex
  - ページ全体の構造、碁盤目状のレイアウト → Grid
  - 迷ったら先に Flex を試し、足りなければ Grid へ
```

## 管理画面の定番レイアウト

```css
.admin-layout {
  display: grid;
  grid-template-areas:
    "sidebar header"
    "sidebar content"
    "sidebar footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr auto;
  min-height: 100vh;
}

.sidebar {
  grid-area: sidebar;
}
.header {
  grid-area: header;
}
.content {
  grid-area: content;
}
.footer {
  grid-area: footer;
}
```

```html
<div class="admin-layout">
  <aside class="sidebar">サイドバー</aside>
  <header class="header">トップナビ</header>
  <main class="content">メインコンテンツ</main>
  <footer class="footer">フッター</footer>
</div>
```

## レスポンシブカードグリッド

```css
.card-grid {
  display: grid;
  /* auto-fill：できるだけ多くの列；minmax：各列の最小 280px、最大 1fr */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

メディアクエリ不要でコンテナ幅に応じて自動的に列数が変わります：

- 広い画面：4〜5列
- 中程度の画面：3列
- 狭い画面：2列
- モバイル：1列

## 雑誌スタイルの混在レイアウト

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
}

/* 大きな画像が複数列・複数行にまたがる */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}
```

```html
<div class="magazine">
  <article class="featured">メイン記事</article>
  <article>小記事</article>
  <article>小記事</article>
  <article>小記事</article>
  <article>小記事</article>
</div>
```

## 子要素を中央に配置（Grid の必殺技）

```css
/* Grid で要素を完璧に中央配置 */
.center-container {
  display: grid;
  place-items: center; /* align-items: center + justify-items: center の省略形 */
  min-height: 100vh;
}
```

Flexbox の `align-items + justify-content` より 1 行少なく書けます。

## 整列制御

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* グリッド全体のコンテナ内での整列 */
  justify-content: center; /* 水平：start | center | end | space-between */
  align-content: start; /* 垂直：同上 */

  /* グリッドセル内の各アイテムの整列 */
  justify-items: stretch; /* 水平：start | center | end | stretch */
  align-items: center; /* 垂直：同上 */
}

/* 特定のアイテムを上書き */
.special-item {
  justify-self: end;
  align-self: start;
}
```

## まとめ

- `grid-template-areas`：ビジュアルにレイアウトを定義できる。管理画面に最適
- `repeat(auto-fill, minmax(280px, 1fr))`：メディアクエリなしのレスポンシブカード
- `span N`：要素を複数列・行にまたがせて雑誌風レイアウトを実現
- `place-items: center`：1行で素早く中央揃え
