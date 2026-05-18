---
title: "CSS Grid 布局进阶：命名网格线与模板区域"
date: 2019-02-13 17:08:59
tags:
  - CSS
readingTime: 1
description: "工作中用了 CSS Grid 一段时间，发现大多数人屐5e止于基础的 `grid-template-columns: repeat(3, 1fr)` 就不用了。Grid 的命名网格线和模板区域才是真正让它秒杀复杂布局的功能。"
---

工作中用了 CSS Grid 一段时间，发现大多数人屐5e止于基础的 `grid-template-columns: repeat(3, 1fr)` 就不用了。Grid 的命名网格线和模板区域才是真正让它秒杀复杂布局的功能。

## 命名网格线

给网格线命名，就能用语义化的方式放置元素：

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

模板区域是可读性最高的 Grid 布局方式——ASCII art 就是布局图：

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

### 响应式布局

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

## 自动填充与自动布局

```css
/* 自动列数，最少 200px，此止套不下 canvas */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit 的区别 */
/* auto-fill: 尽可能多填列，小屏可能空列 */
/* auto-fit:  拉伸现有元素填满容器 */
```

## subgrid（CSS Grid Level 2）

subgrid 是 2019 年讨论热度很高的提案，允许子网格共享父网格的轨道定义：

```css
/* 实现卡片组内对齐很实用 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  display: grid;
  /* grid-row: span 3; 配合 subgrid 实现内容对齐 */
  /* 目前 Firefox 71 已支持，Chrome 尚在开发中 */
}
```

## 实用技巧：gap 替代 margin

```css
/* 之前用 margin 模拟间距很痛苦 */
.item {
  margin: 8px;
}
.container {
  margin: -8px;
} /* 抵消外边 */

/* 现在 grid + gap 一行解决 */
.grid {
  display: grid;
  gap: 16px;
}
```

## 总结

CSS Grid 的命名网格线和 `grid-template-areas` 让复杂页面布局变得可维护。`auto-fill + minmax` 幾乎是我现在开发卡片网格的首选方案，远比手崗 Flexbox 嵌套。
