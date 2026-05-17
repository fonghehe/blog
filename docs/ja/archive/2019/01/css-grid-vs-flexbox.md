---
title: "CSS Gridレイアウト実践：本当にFlexboxを置き換えられるシーン"
date: 2019-01-24 17:49:08
tags:
  - CSS
readingTime: 1
description: "Flexboxは一次元、Gridは二次元だ。Gridを学んだ後、以前Flexboxで無理やり実現していたレイアウトの多くがシンプルになった。"
---

Flexboxは一次元、Gridは二次元だ。Gridを学んだ後、以前Flexboxで無理やり実現していたレイアウトの多くがシンプルになった。

## Gridコアコンセプト

```css
.container {
  display: grid;

  /* 列の定義：3列、各1fr */
  grid-template-columns: 1fr 1fr 1fr;
  /* 短縮形 */
  grid-template-columns: repeat(3, 1fr);

  /* 行の定義 */
  grid-template-rows: 100px auto;

  /* ギャップ */
  gap: 16px; /* 行列のギャップが同じ */
  gap: 20px 16px; /* 行ギャップ 列ギャップ */
}
```

## 典型的なページレイアウト

```css
/* 聖杯レイアウト（ヘッダー + 3列 + フッター） */
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
  grid-template-columns: 200px 1fr 160px;
  grid-template-rows: 60px 1fr 50px;
  min-height: 100vh;
  gap: 0;
}

.header {
  grid-area: header;
}
.nav {
  grid-area: nav;
}
.main {
  grid-area: main;
}
.aside {
  grid-area: aside;
}
.footer {
  grid-area: footer;
}
```

## 自動列数（最もよく使われる）

```css
/* 各列最小250px、自動的に列を埋める */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit の違い */
/* auto-fill：空列のプレースホルダーを保持 */
/* auto-fit：空列を縮小し、既存要素を引き伸ばす */
.card-grid-fit {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

このCSS1行でレスポンシブカードレイアウトが実現できる。メディアクエリ不要！

## 行列をまたぐ要素

```css
/* 要素を2列2行にまたがらせる */
.featured-card {
  grid-column: span 2; /* 2列をまたぐ */
  grid-row: span 2; /* 2行をまたぐ */
}

/* 精密な配置 */
.banner {
  grid-column: 1 / 3; /* ライン1からライン3まで */
  grid-row: 1 / 2;
}
```

## マソンリーレイアウト（近似）

```css
/* CSS Gridのmasonryはまだドラフトなのでマルチカラムで模倣 */
.masonry {
  column-count: 3;
  column-gap: 16px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

## 整列制御

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);
```
