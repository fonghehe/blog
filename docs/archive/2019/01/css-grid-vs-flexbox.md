---
title: "CSS Grid 布局实战：真正替代 Flexbox 的场景"
date: 2019-01-24 17:49:08
tags:
  - CSS
readingTime: 2
description: "Flexbox 一维，Grid 二维。学了 Grid 之后，很多以前用 Flexbox 勉强实现的布局变得简单多了。"
---

Flexbox 一维，Grid 二维。学了 Grid 之后，很多以前用 Flexbox 勉强实现的布局变得简单多了。

## Grid 核心概念

```css
.container {
  display: grid;

  /* 定义列：3 列，各 1fr */
  grid-template-columns: 1fr 1fr 1fr;
  /* 简写 */
  grid-template-columns: repeat(3, 1fr);

  /* 定义行 */
  grid-template-rows: 100px auto;

  /* 间距 */
  gap: 16px; /* 行列间距相同 */
  gap: 20px 16px; /* 行间距 列间距 */
}
```

## 经典页面布局

```css
/* 圣杯布局（header + 3列 + footer） */
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

## 自动适应列数（最常用）

```css
/* 每列最小 250px，自动填充列数 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

/* auto-fill vs auto-fit 区别 */
/* auto-fill：保留空列占位 */
/* auto-fit：收缩空列，让已有元素撑满 */
.card-grid-fit {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

这一行 CSS 实现了响应式卡片布局，不需要写任何媒体查询！

## 元素跨行跨列

```css
/* 让某个元素占 2 列 2 行 */
.featured-card {
  grid-column: span 2; /* 横跨 2 列 */
  grid-row: span 2; /* 纵跨 2 行 */
}

/* 精确定位 */
.banner {
  grid-column: 1 / 3; /* 从第 1 条线到第 3 条线 */
  grid-row: 1 / 2;
}
```

## 瀑布流布局（近似）

```css
/* CSS Grid 的 masonry 还在草案阶段，用多列模拟 */
.masonry {
  column-count: 3;
  column-gap: 16px;
}

.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

## 对齐控制

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* 整个 grid 在容器中的对齐 */
  justify-content: center; /* 水平：start | center | end | space-between */
  align-content: center; /* 垂直：start | center | end */

  /* 单元格内元素的对齐（全部） */
  justify-items: stretch; /* 水平 */
  align-items: stretch; /* 垂直 */
}

/* 单个元素覆盖对齐 */
.special-item {
  justify-self: center;
  align-self: end;
}
```

## Grid vs Flexbox 怎么选

| 场景                           | 推荐           |
| 
------------------------------ | -------------- |
| 一维排列（导航、工具栏）       | Flexbox        |
| 二维布局（页面结构、卡片网格） | Grid           |
| 不确定个数的元素自动排列       | Grid auto-fill |
| 内容决定尺寸                   | Flexbox        |
| 精确控制位置                   | Grid           |

实际项目里两者经常混用：Grid 做大框架，Flexbox 做组件内部布局。

## 兼容性

2019 年 Grid 的兼容性已经很好（Chrome、Firefox、Safari、Edge 都支持）。IE 11 有部分支持（老旧语法），如果要支持 IE 11，用 Autoprefixer 可以处理部分情况。

## 小结

- `grid-template-areas` 让布局语义化，一目了然
- `repeat(auto-fill, minmax(250px, 1fr))` 一行实现响应式网格
- Grid 和 Flexbox 不是替代关系，混用是正常的
