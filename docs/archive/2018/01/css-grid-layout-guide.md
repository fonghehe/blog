---
title: "CSS Grid 布局入门：从 Flexbox 到 Grid 的思维转变"
date: 2018-01-06 14:39:49
tags:
  - CSS
readingTime: 2
description: "CSS Grid 在 2017 年基本完成了主流浏览器的支持（Chrome 57、Firefox 52、Safari 10.1），2018 年已经可以在不需要兼容 IE 的项目里放心使用。但很多人用过 Flexbox 后，一时不太明白 Grid 解决的是什么问题。"
wordCount: 553
---

CSS Grid 在 2017 年基本完成了主流浏览器的支持（Chrome 57、Firefox 52、Safari 10.1），2018 年已经可以在不需要兼容 IE 的项目里放心使用。但很多人用过 Flexbox 后，一时不太明白 Grid 解决的是什么问题。

## Flexbox vs Grid：一维 vs 二维

理解这两者的核心区别：

- **Flexbox** 是一维布局，只控制一个方向（行或列）
- **Grid** 是二维布局，同时控制行和列

实际工作中，**Grid 适合页面级布局，Flexbox 适合组件内部对齐**。两者经常配合使用。

## 基础概念

```css
.container {
  display: grid;

  /* 定义列：3列，各占1份 */
  grid-template-columns: 1fr 1fr 1fr;

  /* 定义行：第一行80px，剩余自动 */
  grid-template-rows: 80px auto;

  /* 网格间距 */
  gap: 16px;
}
```

`fr` 是 Grid 的专属单位，表示可用空间的分数（fraction）。`1fr 1fr 1fr` 等同于三列等宽，但比 `33.33%` 更灵活——它会自动减去 gap 后再分配。

## 实现经典的后台管理布局

以前实现这种布局需要大量 hack，用 Grid 非常直观：

```html
<div class="layout">
  <header class="header">顶部导航</header>
  <aside class="sidebar">侧边栏</aside>
  <main class="content">主内容区</main>
  <footer class="footer">底部</footer>
</div>
```

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 40px;
  grid-template-areas:
    "header  header"
    "sidebar content"
    "footer  footer";
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

`grid-template-areas` 用可视化的方式定义布局，代码即设计稿，非常直观。

## 响应式网格：repeat 和 auto-fill

做响应式卡片网格，不需要写媒体查询：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```

`auto-fill` + `minmax` 的组合效果：

- 每列最小 280px，最大 1fr
- 自动计算能放几列
- 容器变窄时自动减少列数

这一行 CSS 代替了通常需要写三四个断点的响应式代码。

## 跨行/跨列

```css
.featured-post {
  /* 横跨 2 列 */
  grid-column: span 2;

  /* 或者用明确的起止线 */
  grid-column: 1 / 3;
  grid-row: 1 / 2;
}
```

做杂志风格的卡片瀑布流布局时这个特性很有用：

```css
.card:nth-child(1) {
  grid-column: 1 / 3; /* 第一张大图横跨两列 */
  grid-row: 1 / 3;
}
```

## 对齐控制

Grid 的对齐属性比 Flexbox 更全面，因为有两个轴可以分别控制：

```css
.container {
  /* 所有 grid items 在格子内的对齐 */
  align-items: center; /* 垂直方向 */
  justify-items: start; /* 水平方向 */

  /* 整个 grid 在容器内的对齐（当 grid 小于容器时） */
  align-content: center;
  justify-content: space-between;
}

/* 单个 item 覆盖默认对齐 */
.special-item {
  align-self: end;
  justify-self: stretch;
}
```

## 什么时候不用 Grid

Grid 有一定学习成本，不是所有场景都值得用：

- **简单的水平居中**：用 Flexbox 或 margin auto
- **一行按钮组**：Flexbox 更简单
- **需要兼容 IE11**：Grid 在 IE 上有独立的旧语法，实现成本高
- **只有一个方向的排列**：Flexbox 足够

## 浏览器支持现状

截至 2018 年初，全球支持率约 72%。Chrome、Firefox、Safari、Edge 均已支持。IE11 支持旧版语法，需要额外处理。如果你的用户群以 Chrome 为主（很多 B 端产品是这样），现在就可以用。

---

_下一篇：React 16 错误边界机制_
