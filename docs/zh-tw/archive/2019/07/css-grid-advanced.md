---
title: "CSS Grid 進階 - 從 grid-template-areas 到實際佈局案例"
date: 2019-07-08 11:22:58
tags:
  - CSS
readingTime: 5
description: "CSS Grid 已經得到主流瀏覽器的支援有一段時間了。基礎的 `grid-template-columns` 和 `grid-template-rows` 大家都會用，但 `grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax()` 這些進階特性才能真正發揮 G"
---

CSS Grid 已經得到主流瀏覽器的支援有一段時間了。基礎的 `grid-template-columns` 和 `grid-template-rows` 大家都會用，但 `grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax()` 這些進階特性才能真正發揮 Grid 的威力。這篇文章通過幾個實際佈局案例來講解這些特性。

## grid-template-areas：用文字畫布局

傳統方式實現一個經典佈局需要計算行列編號，而 `grid-template-areas` 可以用文字直觀描述佈局結構：

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

程式碼的可讀性一目瞭然——佈局長什麼樣，程式碼就長什麼樣。

### 響應式佈局配合

結合媒體查詢，可以輕鬆改變佈局結構：

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

### 用點號表示空區域

如果某個區域不需要內容，可以用 `.` 表示：

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

這兩個值看起來很像，但行為完全不同。它們都用於 `grid-template-columns`，在容器大小不確定時自動決定列數。

### auto-fill

```css
.grid-auto-fill {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fill` 會盡可能多地建立列軌道，即使沒有足夠的子元素填滿。如果容器寬度 800px，每列最小 200px，那麼會建立 4 個列軌道。即使只有 2 個子元素，第 3、4 列的空軌道依然存在（雖然看不見）。

### auto-fit

```css
.grid-auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fit` 在子元素不夠填滿一行時，會把空的列軌道摺疊為 0 寬度，讓已有的子元素拉伸填滿剩餘空間。

### 區別演示

假設容器寬度 800px，每列最小 200px，只有 2 個子元素：

```
auto-fill（4列，2個空列保留）:
+
--------+--------+--------+--------+
|  item1 |  item2 |   空   |   空   |
+--------+--------+--------+--------+

auto-fit（2列，空列摺疊，子元素拉伸）:
+--------------------+--------------------+
|       item1        |       item2        |
+--------------------+--------------------+
```

實際經驗：
- 做**商品列表、卡片佈局**時，通常用 `auto-fit` 更符合預期
- 做**網格畫廊**等需要固定格子位置的場景，用 `auto-fill`

## minmax() 的妙用

`minmax()` 定義了一個大小範圍，配合 `auto-fill`/`auto-fit` 使用效果極佳：

```css
/* 自適應卡片：最小 280px，最大平均分配 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* 表格場景：第一列固定寬度，其餘列自適應 */
.data-table {
  display: grid;
  grid-template-columns: 60px minmax(200px, 2fr) minmax(100px, 1fr) minmax(80px, 0.5fr);
}
```

`minmax()` 的引數：
- 第一個引數是最小值
- 第二個引數是最大值
- 可以用 `px`、`em`、`fr`、`auto`、`min-content`、`max-content`

## 實戰：響應式 Dashboard 佈局

一個管理後臺 Dashboard 頁面，包含統計卡片、圖表、資料表格：

```html
<div class="dashboard">
  <div class="card card-stat" data-area="stat1">
    <div class="card__value">1,234</div>
    <div class="card__label">今日訪問</div>
  </div>
  <div class="card card-stat" data-area="stat2">
    <div class="card__value">567</div>
    <div class="card__label">新增使用者</div>
  </div>
  <div class="card card-stat" data-area="stat3">
    <div class="card__value">89%</div>
    <div class="card__label">轉化率</div>
  </div>
  <div class="card card-stat" data-area="stat4">
    <div class="card__value">12,345</div>
    <div class="card__label">今日收入</div>
  </div>
  <div class="card card-chart" data-area="chart">
    <h3>流量趨勢</h3>
    <div class="chart-placeholder">ECharts 圖表區域</div>
  </div>
  <div class="card card-table" data-area="table">
    <h3>最近訂單</h3>
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

/* 平板：兩列布局 */
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

/* 手機：單列布局 */
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

這個佈局只用了 CSS，沒有寫一行 JavaScript 來處理響應式。

## 實戰：聖盃佈局的 Grid 版本

經典聖盃佈局（Header + Sidebar + Main + Aside + Footer）：

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

對比 Flexbox 實現聖盃佈局需要大量巢狀，Grid 的優勢在於——一行巢狀都不需要。

## subgrid（實驗性）

`subgrid` 允許巢狀的 Grid 繼承父 Grid 的行或列軌道，解決子元素 Grid 對齊的問題。

比如一個卡片列表，每張卡片的標題、描述、按鈕需要分別對齊：

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

> 注意：截至 2019 年中，`subgrid` 僅 Firefox 71+ 支援（behind flag），Chrome 和 Safari 尚未實現。目前可以通過統一的 `min-height` 或 `align-items: start` 變通處理。

### 當前替代方案

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

## 踩坑記錄

### 坑 1：grid-gap 在 IE11 中不支援

IE11 支援 Grid 但不支援 `gap`（需要寫成 `grid-gap`，且只支援老語法）。如果需要相容 IE11：

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

### 坑 2：Grid 子元素的 min-width 預設值

Grid 子元素預設 `min-width: auto`，意味著內容不會溢位。如果子元素內容過長會撐大列寬：

```css
.grid-item {
  min-width: 0;
}

.grid-item > * {
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### 坑 3：1fr 加上固定寬度元素

```css
/* 如果一行有固定寬度和 1fr，1fr 會吃掉所有剩餘空間 */
.grid {
  grid-template-columns: 200px 1fr;
}

/* 但如果同時有 min-width 限制，效果可能不符合預期 */
/* 1fr 等於 minmax(auto, 1fr)，auto 會根據內容撐開 */
```

## 小結

- `grid-template-areas` 讓佈局結構視覺化，程式碼即設計稿
- `auto-fit` 適合子元素數量不確定的自適應佈局，`auto-fill` 適合需要保留網格結構的場景
- `minmax()` 配合 `auto-fit` 可以實現無媒體查詢的響應式佈局
- Grid 佈局比 Flexbox 更適合二維佈局（同時控制行和列）
- `subgrid` 是未來的方向，但目前相容性有限，需要降級方案
- 注意 IE11 相容和 `min-width: auto` 等細節問題
