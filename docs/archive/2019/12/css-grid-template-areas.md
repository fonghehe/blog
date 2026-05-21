---
title: "CSS Grid template-areas 布局实战"
date: 2019-12-05 10:47:52
tags:
  - CSS
readingTime: 3
description: "CSS Grid 布局规范已经出来几年了，浏览器支持也相当完善（IE11 部分支持带前缀）。但实际项目中，很多同学还是习惯用 Flexbox 解决所有布局问题。最近在重构后台管理系统的页面布局时，我全面采用了 Grid 的 `template-areas` 方案，效果出乎意料的好。这篇文章分享一些实战经验。"
wordCount: 534
---

CSS Grid 布局规范已经出来几年了，浏览器支持也相当完善（IE11 部分支持带前缀）。但实际项目中，很多同学还是习惯用 Flexbox 解决所有布局问题。最近在重构后台管理系统的页面布局时，我全面采用了 Grid 的 `template-areas` 方案，效果出乎意料的好。这篇文章分享一些实战经验。

## 基础概念：grid-template-areas

`grid-template-areas` 允许你用"画"的方式定义布局，每个区域有一个名字，直观且易维护：

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

对应的 HTML 结构非常简洁：

```html
<div class="app-layout">
  <header class="header">Logo</header>
  <nav class="sidebar">Navigation</nav>
  <main class="content">Page Content</main>
</div>
```

## 经典页面布局案例

后台管理系统中最常见的 Dashboard 页面，通常有顶部统计卡片、左侧图表、右侧列表。用 `template-areas` 可以非常直观地表达：

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

## 响应式重排

`template-areas` 最大的优势之一是响应式布局极其直观——只需要重新"画"区域图即可，不需要改 HTML 结构：

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

相比 Flexbox 的响应式方案，Grid 的 `template-areas` 在断点切换时完全不需要调整 HTML 顺序或使用 `order` 属性，视觉语义一目了然。

## 用空单元格处理空白区域

有时候布局中某些区域需要留空，用 `.` 表示即可：

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

## Grid 与 Flexbox 配合使用

Grid 负责宏观页面布局，Flexbox 负责组件内部排列，两者配合是最佳实践：

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

## 实际项目中的注意事项

在实际项目中使用 `template-areas` 有几个要点：

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

## 小结

- `grid-template-areas` 用命名区域定义布局，直观且易于维护，像画图一样组织页面结构
- 响应式布局只需在断点处重新定义 `template-areas`，无需改动 HTML 结构
- Grid 负责宏观布局，Flexbox 负责组件内部排列，两者配合是最佳实践
- 区域名称必须形成矩形，用 `.` 表示空白区域
- 配合 `minmax`、`auto-fit` 和 CSS 变量，可以构建灵活且可维护的布局系统
- 浏览器兼容性已经非常好，IE11 带 `-ms-` 前缀部分支持，现代浏览器全面支持
