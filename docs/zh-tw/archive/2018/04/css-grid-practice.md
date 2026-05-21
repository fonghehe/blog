---
title: "CSS Grid 佈局實戰"
date: 2018-04-19 10:12:47
tags:
  - CSS
readingTime: 1
description: "一月份寫過 CSS Grid 的基礎，這次結合實際專案場景，看看 Grid 怎麼解決 Flex 不好解決的問題。"
wordCount: 186
---

一月份寫過 CSS Grid 的基礎，這次結合實際專案場景，看看 Grid 怎麼解決 Flex 不好解決的問題。

## Grid vs Flex 的選擇

```
Flex：一維佈局（行 OR 列）
Grid：二維佈局（行 AND 列）

經驗法則：
  - 導航欄、工具欄、一行的卡片 → Flex
  - 頁面整體結構、棋盤式佈局 → Grid
  - 不確定時，先試 Flex，不夠用再換 Grid
```

## 後臺管理的經典佈局

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
  <aside class="sidebar">側邊欄</aside>
  <header class="header">頂部導航</header>
  <main class="content">主內容</main>
  <footer class="footer">底部</footer>
</div>
```

## 響應式卡片列表

```css
.card-grid {
  display: grid;
  /* auto-fill：儘可能多的列；minmax：每列最小 280px，最大撐滿 */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

不需要任何媒體查詢，卡片數量會根據容器寬度自動調整。效果：

- 寬屏：4-5列
- 中屏：3列
- 窄屏：2列
- 手機：1列

## 雜誌式圖文混排

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
}

/* 大圖跨越多列多行 */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}
```

```html
<div class="magazine">
  <article class="featured">大圖文章</article>
  <article>小文章</article>
  <article>小文章</article>
  <article>小文章</article>
  <article>小文章</article>
</div>
```

## 讓子元素居中（Grid 的絕殺）

```css
/* 用 Grid 讓單個元素完美居中 */
.center-container {
  display: grid;
  place-items: center; /* 等於 align-items: center + justify-items: center */
  min-height: 100vh;
}
```

比 Flex 的 `align-items + justify-content` 少寫一行。

## 對齊控制

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* 整個 grid 在容器裡的對齊 */
  justify-content: center; /* 水平：start | center | end | space-between */
  align-content: start; /* 垂直：同上 */

  /* grid 內每個 item 的對齊 */
  justify-items: stretch; /* 水平：start | center | end | stretch */
  align-items: center; /* 垂直：同上 */
}

/* 單個 item 覆蓋 */
.special-item {
  justify-self: end;
  align-self: start;
}
```

## 小結

- `grid-template-areas`：視覺化定義佈局，後臺管理頁首選
- `repeat(auto-fill, minmax(280px, 1fr))`：響應式卡片，不用媒體查詢
- `span N`：元素跨越多列/行，做雜誌佈局
- `place-items: center`：快速居中