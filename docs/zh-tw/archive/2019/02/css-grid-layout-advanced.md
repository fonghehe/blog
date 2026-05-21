---
title: "CSS Grid 佈局進階：命名網格線與模板區域"
date: 2019-02-13 17:08:59
tags:
  - CSS
readingTime: 1
description: "工作中用了 CSS Grid 一段時間，發現大多數人屐5e止於基礎的 `grid-template-columns: repeat(3, 1fr)` 就不用了。Grid 的命名網格線和模板區域才是真正讓它秒殺複雜佈局的功能。"
wordCount: 217
---

工作中用了 CSS Grid 一段時間，發現大多數人屐5e止於基礎的 `grid-template-columns: repeat(3, 1fr)` 就不用了。Grid 的命名網格線和模板區域才是真正讓它秒殺複雜佈局的功能。

## 命名網格線

給網格線命名，就能用語義化的方式放置元素：

```css
.layout {
  display: grid;
  grid-template-columns:
    [sidebar-start] 240px
    [sidebar-end content-start] 1fr
    [content-end];
  grid-template-rows:
    [header-start] 60px
    [header-end main-start] auto
    [main-end footer-start] 48px
    [footer-end];
}

.header {
  grid-column: sidebar-start / content-end;
  grid-row: header-start / header-end;
}
.sidebar {
  grid-column: sidebar-start / sidebar-end;
  grid-row: main-start / main-end;
}
.content {
  grid-column: content-start / content-end;
  grid-row: main-start / main-end;
}
.footer {
  grid-column: sidebar-start / content-end;
  grid-row: footer-start / footer-end;
}
```

## grid-template-areas

模板區域是可讀性最高的 Grid 佈局方式——ASCII art 就是佈局圖：

```css
.layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 1fr;
  grid-template-rows: 60px auto 48px;
  min-height: 100vh;
}

.header {
  grid-area: header;
}
.sidebar {
  grid-area: sidebar;
}
.content {
  grid-area: content;
}
.footer {
  grid-area: footer;
}
```

### 響應式佈局

```css
@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
}
```

## 自動填充與自動佈局

```css
/* 自動列數，最少 200px，此止套不下 canvas */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit 的區別 */
/* auto-fill: 儘可能多填列，小屏可能空列 */
/* auto-fit:  拉伸現有元素填滿容器 */
```

## subgrid（CSS Grid Level 2）

subgrid 是 2019 年討論熱度很高的提案，允許子網格共享父網格的軌道定義：

```css
/* 實現卡片組內對齊很實用 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  display: grid;
  /* grid-row: span 3; 配合 subgrid 實現內容對齊 */
  /* 目前 Firefox 71 已支援，Chrome 尚在開發中 */
}
```

## 實用技巧：gap 替代 margin

```css
/* 之前用 margin 模擬間距很痛苦 */
.item {
  margin: 8px;
}
.container {
  margin: -8px;
} /* 抵消外邊 */

/* 現在 grid + gap 一行解決 */
.grid {
  display: grid;
  gap: 16px;
}
```

## 總結

CSS Grid 的命名網格線和 `grid-template-areas` 讓複雜頁面佈局變得可維護。`auto-fill + minmax` 幾乎是我現在開發卡片網格的首選方案，遠比手崗 Flexbox 巢狀。
