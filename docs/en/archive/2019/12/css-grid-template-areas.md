---
title: "CSS Grid template-areas Layout in Practice"
date: 2019-12-05 10:47:52
tags:
  - CSS
readingTime: 3
description: "The CSS Grid spec has been around for a few years, and browser support is now quite solid (IE11 supports it partially, with a prefix). Yet in real projects many developers still reach for Flexbox to solve every layout problem. While refactoring the page layout of an admin dashboard recently, I adopted Grid's `template-areas` approach throughout, and the results were unexpectedly good. This post shares some hands-on experience."
wordCount: 348
---

The CSS Grid spec has been around for a few years, and browser support is now quite solid (IE11 supports it partially, with a prefix). Yet in real projects many developers still reach for Flexbox to solve every layout problem. While refactoring the page layout of an admin dashboard recently, I adopted Grid's `template-areas` approach throughout, and the results were unexpectedly good. This post shares some hands-on experience.

## Basic Concepts: grid-template-areas

`grid-template-areas` lets you define a layout by "drawing" it—each region gets a name, which is intuitive and easy to maintain:

```css
/* 最经典的后台管理布局 */
.app-layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "sidebar content content";
  grid-template-columns: 240px 1fr 1fr;
  grid-template-rows: 64px 1fr auto;
  min-height: 100vh;
  gap: 0;
}

.header {
  grid-area: header;
  background: #001529;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.sidebar {
  grid-area: sidebar;
  background: #001529;
  color: #fff;
  overflow-y: auto;
}

.content {
  grid-area: content;
  padding: 24px;
  overflow-y: auto;
  background: #f0f2f5;
}
```

The corresponding HTML structure is very clean:

```html
<div class="app-layout">
  <header class="header">Logo</header>
  <nav class="sidebar">Navigation</nav>
  <main class="content">Page Content</main>
</div>
```

## Classic Page Layout Cases

The most common dashboard layout in an admin system has stat cards up top, charts on the left, and a list on the right. `template-areas` expresses this very intuitively:

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  stats"
    "chart1 chart2 list"
    "chart1 chart2 list";
  grid-template-columns: 1fr 1fr 320px;
  grid-template-rows: auto 1fr 1fr;
  gap: 16px;
  padding: 16px;
}

.stats-row {
  grid-area: stats;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.chart-primary {
  grid-area: chart1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.chart-secondary {
  grid-area: chart2;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.side-list {
  grid-area: list;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}
```

```html
<div class="dashboard">
  <div class="stats-row">
    <div class="stat-card">日活用户: 12,345</div>
    <div class="stat-card">订单量: 678</div>
    <div class="stat-card">销售额: ¥89,012</div>
    <div class="stat-card">转化率: 3.4%</div>
  </div>
  <div class="chart-primary">
    <h3>访问趋势</h3>
    <div id="trend-chart"></div>
  </div>
  <div class="chart-secondary">
    <h3>渠道分布</h3>
    <div id="channel-chart"></div>
  </div>
  <div class="side-list">
    <h3>最近订单</h3>
    <ul id="order-list"></ul>
  </div>
</div>
```

## Responsive Reflow

One of `template-areas`' biggest strengths is how intuitive responsive layouts become—you simply redraw the region map, with no need to touch the HTML structure:

```css
/* 桌面端：三列布局 */
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  stats"
    "chart1 chart2 list"
    "chart1 chart2 list";
  grid-template-columns: 1fr 1fr 320px;
  gap: 16px;
}

/* 平板端：两列布局 */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-areas:
      "stats  stats"
      "chart1 chart1"
      "chart2 list";
    grid-template-columns: 1fr 1fr;
  }
}

/* 移动端：单列堆叠 */
@media (max-width: 768px) {
  .dashboard {
    grid-template-areas:
      "stats"
      "chart1"
      "chart2"
      "list";
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

Compared with Flexbox's responsive approach, Grid's `template-areas` needs no HTML reordering or use of the `order` property at breakpoints, and the visual structure is clear at a glance.

## Handling Empty Areas with Empty Cells

Sometimes you need to leave certain regions empty; just use `.` to represent them:

```css
/* 侧边栏只占部分高度的布局 */
.complex-layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 200px 1fr 280px;
  grid-template-rows: 60px 1fr 1fr 48px;
}

/* 如果不需要 aside，用 . 填充 */
.simple-layout {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar content"
    "sidebar content"
    "footer  footer";
  grid-template-columns: 200px 1fr;
  grid-template-rows: 60px 1fr auto 48px;
}
```

## Using Grid and Flexbox Together

Grid handles the macro page layout while Flexbox handles arrangement inside components—using them together is the best practice:

```css
/* Grid 负责整体布局 */
.page-layout {
  display: grid;
  grid-template-areas:
    "header header"
    "nav    main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 64px 1fr 48px;
  min-height: 100vh;
}

/* Flexbox 负责 header 内部排列 */
.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

/* Flexbox 负责导航项排列 */
.nav {
  grid-area: nav;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
}

.main {
  grid-area: main;
  padding: 24px;
  overflow-y: auto;
}
```

## Notes for Real Projects

There are a few key points to keep in mind when using `template-areas` in real projects:

```css
/* 1. 区域名称必须形成矩形，不能有 L 形或 T 形 */
/* 错误示例：下面的写法会失效 */
/* grid-template-areas:
    "a a b"
    "a a c"
    "d d c";  -- 这是合法的，但 "a a b" / "a a c" 中 a 形成了矩形 */

/* 2. 使用 minmax 避免内容溢出 */
.dashboard {
  grid-template-columns: minmax(200px, 240px) 1fr minmax(280px, 320px);
}

/* 3. 使用 auto-fit / auto-fill 处理动态列数 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* 4. 配合 CSS 变量实现主题化 */
:root {
  --sidebar-width: 240px;
  --header-height: 64px;
}

.app-layout {
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
}
```

## Summary

- `grid-template-areas` defines layouts with named regions—intuitive, easy to maintain, and you organize the page structure as if you were drawing it
- Responsive layouts only need `template-areas` redefined at each breakpoint, with no changes to the HTML structure
- Grid owns the macro layout and Flexbox owns intra-component arrangement; combining them is the best practice
- Region names must form a rectangle; use `.` to denote empty regions
- Paired with `minmax`, `auto-fit`, and CSS variables, you can build a flexible, maintainable layout system
- Browser support is already excellent: IE11 supports it partially with the `-ms-` prefix, and modern browsers support it fully
