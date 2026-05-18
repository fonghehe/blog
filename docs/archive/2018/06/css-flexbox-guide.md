---
title: "CSS Flexbox 布局完全指南"
date: 2018-06-14 17:13:56
tags:
  - CSS
readingTime: 1
description: "Flexbox 是现在最常用的布局方式，但有些属性老是记不住。整理一份速查手册。"
---

Flexbox 是现在最常用的布局方式，但有些属性老是记不住。整理一份速查手册。

## 容器属性

```css
.container {
  display: flex; /* 或 inline-flex */

  /* 主轴方向 */
  flex-direction: row; /* → 默认 */
  flex-direction: row-reverse; /* ← */
  flex-direction: column; /* ↓ */
  flex-direction: column-reverse; /* ↑ */

  /* 换行 */
  flex-wrap: nowrap; /* 不换行（默认） */
  flex-wrap: wrap; /* 换行，向下 */
  flex-wrap: wrap-reverse; /* 换行，向上 */

  /* 主轴对齐（justify-content） */
  justify-content: flex-start; /* 左/上对齐（默认） */
  justify-content: flex-end; /* 右/下对齐 */
  justify-content: center; /* 居中 */
  justify-content: space-between; /* 两端对齐，间隔相等 */
  justify-content: space-around; /* 每项两侧间隔相等 */
  justify-content: space-evenly; /* 所有间隔相等 */

  /* 交叉轴对齐（align-items） */
  align-items: stretch; /* 拉伸填满（默认） */
  align-items: flex-start; /* 顶部对齐 */
  align-items: flex-end; /* 底部对齐 */
  align-items: center; /* 居中 */
  align-items: baseline; /* 基线对齐 */

  /* 多行对齐（align-content，只在换行时有效） */
  align-content: flex-start;
  align-content: space-between;

  /* gap（新属性，替代 margin 技巧） */
  gap: 16px; /* 行列间距相同 */
  gap: 16px 24px; /* 行间距 列间距 */
}
```

## 子项属性

```css
.item {
  /* 顺序 */
  order: 0; /* 默认 0，越小越靠前 */

  /* 放大比例（有剩余空间时） */
  flex-grow: 0; /* 默认不放大 */
  flex-grow: 1; /* 占据所有剩余空间 */

  /* 缩小比例（空间不足时） */
  flex-shrink: 1; /* 默认按比例缩小 */
  flex-shrink: 0; /* 不缩小 */

  /* 主轴上的初始大小 */
  flex-basis: auto; /* 默认：由内容决定 */
  flex-basis: 200px; /* 指定基础宽度 */

  /* 简写：grow shrink basis */
  flex: 1; /* 1 1 0% */
  flex: auto; /* 1 1 auto */
  flex: none; /* 0 0 auto */
  flex: 0 0 200px; /* 固定 200px，不增不缩 */

  /* 覆盖容器的 align-items */
  align-self: center;
}
```

## 常用布局模式

```css
/* 垂直水平居中 */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 左右布局，右侧固定宽度 */
.layout {
  display: flex;
}
.layout-main {
  flex: 1;
}
.layout-sidebar {
  width: 240px;
  flex-shrink: 0;
}

/* 底部固定的页脚 */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1;
} /* 撑开，把 footer 推到底部 */

/* 等高列 */
.columns {
  display: flex; /* 子项默认 align-items: stretch，自动等高 */
}

/* 自适应卡片列表（每行 3 列） */
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 0 0 calc(33.33% - 12px); /* 减去 gap */
}
```

## 小结

- `justify-content` 控制主轴，`align-items` 控制交叉轴
- `flex: 1` 是最常用的等分写法
- `gap` 属性比用 `margin` 做间距干净很多
- `flex-shrink: 0` 防止固定宽度的侧边栏被压缩
