---
title: "CSS Grid 布局实战"
date: 2018-04-19 10:12:47
tags:
  - CSS
---

一月份写过 CSS Grid 的基础，这次结合实际项目场景，看看 Grid 怎么解决 Flex 不好解决的问题。

## Grid vs Flex 的选择

```
Flex：一维布局（行 OR 列）
Grid：二维布局（行 AND 列）

经验法则：
  - 导航栏、工具栏、一行的卡片 → Flex
  - 页面整体结构、棋盘式布局 → Grid
  - 不确定时，先试 Flex，不够用再换 Grid
```

## 后台管理的经典布局

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
  <aside class="sidebar">侧边栏</aside>
  <header class="header">顶部导航</header>
  <main class="content">主内容</main>
  <footer class="footer">底部</footer>
</div>
```

## 响应式卡片列表

```css
.card-grid {
  display: grid;
  /* auto-fill：尽可能多的列；minmax：每列最小 280px，最大撑满 */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

不需要任何媒体查询，卡片数量会根据容器宽度自动调整。效果：

- 宽屏：4-5列
- 中屏：3列
- 窄屏：2列
- 手机：1列

## 杂志式图文混排

```css
.magazine {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 200px;
  gap: 8px;
}

/* 大图跨越多列多行 */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}
```

```html
<div class="magazine">
  <article class="featured">大图文章</article>
  <article>小文章</article>
  <article>小文章</article>
  <article>小文章</article>
  <article>小文章</article>
</div>
```

## 让子元素居中（Grid 的绝杀）

```css
/* 用 Grid 让单个元素完美居中 */
.center-container {
  display: grid;
  place-items: center; /* 等于 align-items: center + justify-items: center */
  min-height: 100vh;
}
```

比 Flex 的 `align-items + justify-content` 少写一行。

## 对齐控制

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 200px);

  /* 整个 grid 在容器里的对齐 */
  justify-content: center; /* 水平：start | center | end | space-between */
  align-content: start; /* 垂直：同上 */

  /* grid 内每个 item 的对齐 */
  justify-items: stretch; /* 水平：start | center | end | stretch */
  align-items: center; /* 垂直：同上 */
}

/* 单个 item 覆盖 */
.special-item {
  justify-self: end;
  align-self: start;
}
```

## 小结

- `grid-template-areas`：视觉化定义布局，后台管理页首选
- `repeat(auto-fill, minmax(280px, 1fr))`：响应式卡片，不用媒体查询
- `span N`：元素跨越多列/行，做杂志布局
- `place-items: center`：快速居中