---
title: "CSS Grid 进阶 - 从 grid-template-areas 到实际布局案例"
date: 2019-07-08 11:22:58
tags:
  - CSS
readingTime: 5
description: "CSS Grid 已经得到主流浏览器的支持有一段时间了。基础的 `grid-template-columns` 和 `grid-template-rows` 大家都会用，但 `grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax()` 这些进阶特性才能真正发挥 G"
---

CSS Grid 已经得到主流浏览器的支持有一段时间了。基础的 `grid-template-columns` 和 `grid-template-rows` 大家都会用，但 `grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax()` 这些进阶特性才能真正发挥 Grid 的威力。这篇文章通过几个实际布局案例来讲解这些特性。

## grid-template-areas：用文字画布局

传统方式实现一个经典布局需要计算行列编号，而 `grid-template-areas` 可以用文字直观描述布局结构：

```css
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 200px;
  grid-template-rows: 60px 1fr 50px;
  grid-gap: 0;
}

.header  { grid-area: header; }
.sidebar { grid-area: sidebar; }
.content { grid-area: content; }
.aside   { grid-area: aside; }
.footer  { grid-area: footer; }
```

代码的可读性一目了然——布局长什么样，代码就长什么样。

### 响应式布局配合

结合媒体查询，可以轻松改变布局结构：

```css
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas:
    "header  header"
    "sidebar content"
    "footer  footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 50px;
}

.aside { display: none; }

@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: 50px 1fr 50px;
  }

  .sidebar { display: none; }
}
```

### 用点号表示空区域

如果某个区域不需要内容，可以用 `.` 表示：

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  chart"
    "table  table  chart"
    ".      .      chart";
  grid-template-columns: 1fr 1fr 300px;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
}
```

## auto-fill vs auto-fit

这两个值看起来很像，但行为完全不同。它们都用于 `grid-template-columns`，在容器大小不确定时自动决定列数。

### auto-fill

```css
.grid-auto-fill {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fill` 会尽可能多地创建列轨道，即使没有足够的子元素填满。如果容器宽度 800px，每列最小 200px，那么会创建 4 个列轨道。即使只有 2 个子元素，第 3、4 列的空轨道依然存在（虽然看不见）。

### auto-fit

```css
.grid-auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fit` 在子元素不够填满一行时，会把空的列轨道折叠为 0 宽度，让已有的子元素拉伸填满剩余空间。

### 区别演示

假设容器宽度 800px，每列最小 200px，只有 2 个子元素：

```
auto-fill（4列，2个空列保留）:
+
--------+--------+--------+--------+
|  item1 |  item2 |   空   |   空   |
+--------+--------+--------+--------+

auto-fit（2列，空列折叠，子元素拉伸）:
+--------------------+--------------------+
|       item1        |       item2        |
+--------------------+--------------------+
```

实际经验：
- 做**商品列表、卡片布局**时，通常用 `auto-fit` 更符合预期
- 做**网格画廊**等需要固定格子位置的场景，用 `auto-fill`

## minmax() 的妙用

`minmax()` 定义了一个大小范围，配合 `auto-fill`/`auto-fit` 使用效果极佳：

```css
/* 自适应卡片：最小 280px，最大平均分配 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* 表格场景：第一列固定宽度，其余列自适应 */
.data-table {
  display: grid;
  grid-template-columns: 60px minmax(200px, 2fr) minmax(100px, 1fr) minmax(80px, 0.5fr);
}
```

`minmax()` 的参数：
- 第一个参数是最小值
- 第二个参数是最大值
- 可以用 `px`、`em`、`fr`、`auto`、`min-content`、`max-content`

## 实战：响应式 Dashboard 布局

一个管理后台 Dashboard 页面，包含统计卡片、图表、数据表格：

```html
<div class="dashboard">
  <div class="card card-stat" data-area="stat1">
    <div class="card__value">1,234</div>
    <div class="card__label">今日访问</div>
  </div>
  <div class="card card-stat" data-area="stat2">
    <div class="card__value">567</div>
    <div class="card__label">新增用户</div>
  </div>
  <div class="card card-stat" data-area="stat3">
    <div class="card__value">89%</div>
    <div class="card__label">转化率</div>
  </div>
  <div class="card card-stat" data-area="stat4">
    <div class="card__value">12,345</div>
    <div class="card__label">今日收入</div>
  </div>
  <div class="card card-chart" data-area="chart">
    <h3>流量趋势</h3>
    <div class="chart-placeholder">ECharts 图表区域</div>
  </div>
  <div class="card card-table" data-area="table">
    <h3>最近订单</h3>
    <table><!-- ... --></table>
  </div>
</div>
```

```css
.dashboard {
  display: grid;
  gap: 20px;
  padding: 20px;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  grid-template-areas:
    "stat1 stat2 stat3 stat4"
    "chart chart table table";
}

.card-stat[data-area="stat1"] { grid-area: stat1; }
.card-stat[data-area="stat2"] { grid-area: stat2; }
.card-stat[data-area="stat3"] { grid-area: stat3; }
.card-stat[data-area="stat4"] { grid-area: stat4; }
.card-chart { grid-area: chart; }
.card-table { grid-area: table; }

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* 平板：两列布局 */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-columns: repeat(2, 1fr);
    grid-template-areas:
      "stat1 stat2"
      "stat3 stat4"
      "chart  chart"
      "table  table";
  }
}

/* 手机：单列布局 */
@media (max-width: 640px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-areas:
      "stat1"
      "stat2"
      "stat3"
      "stat4"
      "chart"
      "table";
  }
}
```

这个布局只用了 CSS，没有写一行 JavaScript 来处理响应式。

## 实战：圣杯布局的 Grid 版本

经典圣杯布局（Header + Sidebar + Main + Aside + Footer）：

```css
.holy-grail {
  display: grid;
  min-height: 100vh;
  grid-template:
    "header header header" 60px
    "nav    main   aside" 1fr
    "footer footer footer" 40px
    / 200px 1fr    200px;
}

.holy-grail__header { grid-area: header; }
.holy-grail__nav    { grid-area: nav; }
.holy-grail__main   { grid-area: main; }
.holy-grail__aside  { grid-area: aside; }
.holy-grail__footer { grid-area: footer; }
```

对比 Flexbox 实现圣杯布局需要大量嵌套，Grid 的优势在于——一行嵌套都不需要。

## subgrid（实验性）

`subgrid` 允许嵌套的 Grid 继承父 Grid 的行或列轨道，解决子元素 Grid 对齐的问题。

比如一个卡片列表，每张卡片的标题、描述、按钮需要分别对齐：

```css
.card-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3;
}
```

> 注意：截至 2019 年中，`subgrid` 仅 Firefox 71+ 支持（behind flag），Chrome 和 Safari 尚未实现。目前可以通过统一的 `min-height` 或 `align-items: start` 变通处理。

### 当前替代方案

```css
.card-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  align-items: start;
}

.card {
  display: flex;
  flex-direction: column;
}

.card__title {
  min-height: 48px;
}

.card__body {
  flex: 1;
}

.card__action {
  margin-top: auto;
}
```

## 踩坑记录

### 坑 1：grid-gap 在 IE11 中不支持

IE11 支持 Grid 但不支持 `gap`（需要写成 `grid-gap`，且只支持老语法）。如果需要兼容 IE11：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

@supports not (display: grid) {
  .card-grid {
    display: flex;
    flex-wrap: wrap;
    margin: -10px;
  }
  .card-grid > * {
    width: calc(33.333% - 20px);
    margin: 10px;
  }
}
```

### 坑 2：Grid 子元素的 min-width 默认值

Grid 子元素默认 `min-width: auto`，意味着内容不会溢出。如果子元素内容过长会撑大列宽：

```css
.grid-item {
  min-width: 0;
}

.grid-item > * {
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 坑 3：1fr 加上固定宽度元素

```css
/* 如果一行有固定宽度和 1fr，1fr 会吃掉所有剩余空间 */
.grid {
  grid-template-columns: 200px 1fr;
}

/* 但如果同时有 min-width 限制，效果可能不符合预期 */
/* 1fr 等于 minmax(auto, 1fr)，auto 会根据内容撑开 */
```

## 小结

- `grid-template-areas` 让布局结构可视化，代码即设计稿
- `auto-fit` 适合子元素数量不确定的自适应布局，`auto-fill` 适合需要保留网格结构的场景
- `minmax()` 配合 `auto-fit` 可以实现无媒体查询的响应式布局
- Grid 布局比 Flexbox 更适合二维布局（同时控制行和列）
- `subgrid` 是未来的方向，但目前兼容性有限，需要降级方案
- 注意 IE11 兼容和 `min-width: auto` 等细节问题
