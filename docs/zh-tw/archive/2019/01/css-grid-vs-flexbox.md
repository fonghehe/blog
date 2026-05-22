---
title: "CSS Grid 佈局實戰：真正替代 Flexbox 的場景"
date: 2019-01-24 17:49:08
tags:
  - CSS
readingTime: 2
description: "Flexbox 一維，Grid 二維。學了 Grid 之後，很多以前用 Flexbox 勉強實現的佈局變得簡單多了。"
wordCount: 275
---

Flexbox 一維，Grid 二維。學了 Grid 之後，很多以前用 Flexbox 勉強實現的佈局變得簡單多了。

## Grid 核心概念

```css
.container {
  display: grid;

  /* 定義列：3 列，各 1fr */
  grid-template-columns: 1fr 1fr 1fr;
  /* 簡寫 */
  grid-template-columns: repeat(3, 1fr);

  /* 定義行 */
  grid-template-rows: 100px auto;

  /* 間距 */
  gap: 16px; /* 行列間距相同 */
  gap: 20px 16px; /* 行間距 列間距 */
}
```

## 經典頁面佈局

```css
/* 聖盃佈局（header + 3列 + footer） */
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

## 自動適應列數（最常用）

```css
/* 每列最小 250px，自動填充列數 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit 區別 */
/* auto-fill：保留空列佔位 */
/* auto-fit：收縮空列，讓已有元素撐滿 */
.card-grid-fit {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

這一行 CSS 實現了響應式卡片佈局，不需要寫任何媒體查詢！

## 元素跨行跨列

```css
/* 讓某個元素佔 2 列 2 行 */
.featured-card {
  grid-column: span 2; /* 橫跨 2 列 */
  grid-row: span 2; /* 縱跨 2 行 */
}

/* 精確定位 */
.banner {
  grid-column: 1 / 3; /* 從第 1 條線到第 3 條線 */
  grid-row: 1 / 2;
}
```

## 瀑布流佈局（近似）

```css
/* CSS Grid 的 masonry 還在草案階段，用多列模擬 */
.masonry {
  column-count: 3;
  column-gap: 16px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

## 對齊控製

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* 整個 grid 在容器中的對齊 */
  justify-content: center; /* 水平：start | center | end | space-between */
  align-content: center; /* 垂直：start | center | end */

  /* 單元格內元素的對齊（全部） */
  justify-items: stretch; /* 水平 */
  align-items: stretch; /* 垂直 */
}

/* 單個元素覆蓋對齊 */
.special-item {
  justify-self: center;
  align-self: end;
}
```

## Grid vs Flexbox 怎麼選

| 場景                           | 推薦           |
| 
------------------------------ | -------------- |
| 一維排列（導航、工具欄）       | Flexbox        |
| 二維佈局（頁面結構、卡片網格） | Grid           |
| 不確定個數的元素自動排列       | Grid auto-fill |
| 內容決定尺寸                   | Flexbox        |
| 精確控製位置                   | Grid           |

實際專案裡兩者經常混用：Grid 做大框架，Flexbox 做元件內部佈局。

## 相容性

2019 年 Grid 的相容性已經很好（Chrome、Firefox、Safari、Edge 都支援）。IE 11 有部分支援（老舊語法），如果要支援 IE 11，用 Autoprefixer 可以處理部分情況。

## 小結

- `grid-template-areas` 讓佈局語義化，一目瞭然
- `repeat(auto-fill, minmax(250px, 1fr))` 一行實現響應式網格
- Grid 和 Flexbox 不是替代關係，混用是正常的
