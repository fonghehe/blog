---
title: "CSS Grid template-areas 佈局實戰：落地路徑與實戰建議"
date: 2019-12-05 10:47:52
tags:
  - CSS
readingTime: 3
description: "CSS Grid 佈局規範已經出來幾年了，瀏覽器支援也相當完善（IE11 部分支援帶前綴）。但實際項目中，很多同學還是習慣用 Flexbox 解決所有佈局問題。最近在重構後臺管理系統的頁面佈局時，我全面採用了 Grid 的 `template-areas` 方案，效果出乎意料的好。這篇文章分享一些實戰經驗。"
wordCount: 534
---

CSS Grid 佈局規範已經出來幾年了，瀏覽器支援也相當完善（IE11 部分支援帶前綴）。但實際項目中，很多同學還是習慣用 Flexbox 解決所有佈局問題。最近在重構後臺管理系統的頁面佈局時，我全面採用了 Grid 的 `template-areas` 方案，效果出乎意料的好。這篇文章分享一些實戰經驗。

## 基礎概念：grid-template-areas

`grid-template-areas` 允許你用"畫"的方式定義佈局，每個區域有一個名字，直觀且易維護：

```css
/* 最經典的後臺管理佈局 */
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

對應的 HTML 結構非常簡潔：

```html
<div class="app-layout">
  <header class="header">Logo</header>
  <nav class="sidebar">Navigation</nav>
  <main class="content">Page Content</main>
</div>
```

## 經典頁面佈局案例

後臺管理系統中最常見的 Dashboard 頁面，通常有頂部統計卡片、左側圖表、右側列表。用 `template-areas` 可以非常直觀地表達：

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
    <div class="stat-card">訂單量: 678</div>
    <div class="stat-card">銷售額: ¥89,012</div>
    <div class="stat-card">轉化率: 3.4%</div>
  </div>
  <div class="chart-primary">
    <h3>訪問趨勢</h3>
    <div id="trend-chart"></div>
  </div>
  <div class="chart-secondary">
    <h3>渠道分佈</h3>
    <div id="channel-chart"></div>
  </div>
  <div class="side-list">
    <h3>最近訂單</h3>
    <ul id="order-list"></ul>
  </div>
</div>
```

## 響應式重排

`template-areas` 最大的優勢之一是響應式佈局極其直觀——隻需要重新"畫"區域圖即可，不需要改 HTML 結構：

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

/* 平板端：兩列布局 */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-areas:
      "stats  stats"
      "chart1 chart1"
      "chart2 list";
    grid-template-columns: 1fr 1fr;
  }
}

/* 移動端：單列堆疊 */
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

相比 Flexbox 的響應式方案，Grid 的 `template-areas` 在斷點切換時完全不需要調整 HTML 順序或使用 `order` 屬性，視覺語義一目瞭然。

## 用空單元格處理空白區域

有時候佈局中某些區域需要留空，用 `.` 表示即可：

```css
/* 側邊欄隻佔部分高度的佈局 */
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

## Grid 與 Flexbox 配合使用

Grid 負責宏觀頁面佈局，Flexbox 負責組件內部排列，兩者配合是最佳實踐：

```css
/* Grid 負責整體佈局 */
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

/* Flexbox 負責 header 內部排列 */
.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

/* Flexbox 負責導航項排列 */
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

## 實際項目中的注意事項

在實際項目中使用 `template-areas` 有幾個要點：

```css
/* 1. 區域名稱必須形成矩形，不能有 L 形或 T 形 */
/* 錯誤示例：下面的寫法會失效 */
/* grid-template-areas:
    "a a b"
    "a a c"
    "d d c";  -- 這是合法的，但 "a a b" / "a a c" 中 a 形成了矩形 */

/* 2. 使用 minmax 避免內容溢出 */
.dashboard {
  grid-template-columns: minmax(200px, 240px) 1fr minmax(280px, 320px);
}

/* 3. 使用 auto-fit / auto-fill 處理動態列數 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* 4. 配合 CSS 變量實現主題化 */
:root {
  --sidebar-width: 240px;
  --header-height: 64px;
}

.app-layout {
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
}
```

## 小結

- `grid-template-areas` 用命名區域定義佈局，直觀且易於維護，像畫圖一樣組織頁面結構
- 響應式佈局隻需在斷點處重新定義 `template-areas`，無需改動 HTML 結構
- Grid 負責宏觀佈局，Flexbox 負責組件內部排列，兩者配合是最佳實踐
- 區域名稱必須形成矩形，用 `.` 表示空白區域
- 配合 `minmax`、`auto-fit` 和 CSS 變量，可以構建靈活且可維護的佈局系統
- 瀏覽器兼容性已經非常好，IE11 帶 `-ms-` 前綴部分支持，現代瀏覽器全面支持
