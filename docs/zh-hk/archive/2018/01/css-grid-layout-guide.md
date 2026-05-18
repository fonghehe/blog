---
title: "CSS Grid 佈局入門：從 Flexbox 到 Grid 嘅思維轉變"
date: 2018-01-06 14:39:49
tags:
  - CSS
readingTime: 2
description: "CSS Grid 喺 2017 年基本完成咗主流瀏覽器嘅支援（Chrome 57、Firefox 52、Safari 10.1），2018 年已經可以喺唔需要兼容 IE 嘅項目裡面放心使用。但好多人用過 Flexbox 之後，一時唔太明白 Grid 解決嘅係咩問題。"
---

CSS Grid 喺 2017 年基本完成咗主流瀏覽器嘅支援（Chrome 57、Firefox 52、Safari 10.1），2018 年已經可以喺唔需要兼容 IE 嘅項目裡面放心使用。但好多人用過 Flexbox 之後，一時唔太明白 Grid 解決嘅係咩問題。

## Flexbox vs Grid：一維 vs 二維

理解呢兩者嘅核心區別：

- **Flexbox** 係一維佈局，只控制一個方向（行或列）
- **Grid** 係二維佈局，同時控制行同列

實際工作中，**Grid 適合頁面級佈局，Flexbox 適合組件內部對齊**。兩者經常配合使用。

## 基礎概念

```css
.container {
  display: grid;

  /* 定義列：3 列，各佔 1 份 */
  grid-template-columns: 1fr 1fr 1fr;

  /* 定義行：第一行 80px，剩餘自動 */
  grid-template-rows: 80px auto;

  /* 網格間距 */
  gap: 16px;
}
```

`fr` 係 Grid 嘅專屬單位，表示可用空間嘅分數（fraction）。`1fr 1fr 1fr` 等同於三列等寬，但比 `33.33%` 更靈活——佢會自動扣除 gap 後再分配。

## 實現經典嘅後台管理佈局

以前實現呢種佈局需要大量 hack，用 Grid 非常直觀：

```html
<div class="layout">
  <header class="header">頂部導航</header>
  <aside class="sidebar">側邊欄</aside>
  <main class="content">主內容區</main>
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

`grid-template-areas` 用可視化嘅方式定義佈局，代碼即設計稿，非常直觀。

## 響應式網格：repeat 同 auto-fill

做響應式卡片網格，唔需要寫媒體查詢：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```

`auto-fill` + `minmax` 嘅組合效果：

- 每列最小 280px，最大 1fr
- 自動計算能放幾列
- 容器變窄時自動減少列數

呢一行 CSS 代替咗通常需要寫三四個斷點嘅響應式代碼。

## 跨行/跨列

```css
.featured-post {
  /* 橫跨 2 列 */
  grid-column: span 2;

  /* 或者用明確嘅起止線 */
  grid-column: 1 / 3;
  grid-row: 1 / 2;
}
```

做雜誌風格嘅卡片瀑布流佈局時呢個特性好有用：

```css
.card:nth-child(1) {
  grid-column: 1 / 3; /* 第一張大圖橫跨兩列 */
  grid-row: 1 / 3;
}
```

## 對齊控制

Grid 嘅對齊屬性比 Flexbox 更全面，因為有兩個軸可以分別控制：

```css
.container {
  /* 所有 grid items 喺格子內嘅對齊 */
  align-items: center; /* 垂直方向 */
  justify-items: start; /* 水平方向 */

  /* 整個 grid 喺容器內嘅對齊（當 grid 細過容器時） */
  align-content: center;
  justify-content: space-between;
}

/* 單個 item 覆蓋默認對齊 */
.special-item {
  align-self: end;
  justify-self: stretch;
}
```

## 咩時候唔用 Grid

Grid 有一定學習成本，唔係所有場景都值得用：

- **簡單嘅水平居中**：用 Flexbox 或 margin auto
- **一行按鈕組**：Flexbox 更簡單
- **需要兼容 IE11**：Grid 喺 IE 上有獨立嘅舊語法，實現成本高
- **只有一個方向嘅排列**：Flexbox 就夠

## 瀏覽器支援現狀

截至 2018 年初，全球支援率約 72%。Chrome、Firefox、Safari、Edge 均已支援。IE11 支援舊版語法，需要額外處理。如果你嘅用戶群以 Chrome 為主（好多 B 端產品係咁），現在就可以用。

---

_下一篇：React 16 錯誤邊界機制_
