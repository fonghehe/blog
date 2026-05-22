---
title: "CSS Grid 佈局入門：從 Flexbox 到 Grid 的思維轉變"
date: 2018-01-06 14:39:49
tags:
  - CSS
readingTime: 2
description: "CSS Grid 在 2017 年基本完成了主流瀏覽器的支援（Chrome 57、Firefox 52、Safari 10.1），2018 年已經可以在不需要相容 IE 的專案裡放心使用。但很多人用過 Flexbox 後，一時不太明白 Grid 解決的是什麼問題。"
wordCount: 557
---

CSS Grid 在 2017 年基本完成了主流瀏覽器的支援（Chrome 57、Firefox 52、Safari 10.1），2018 年已經可以在不需要相容 IE 的專案裡放心使用。但很多人用過 Flexbox 後，一時不太明白 Grid 解決的是什麼問題。

## Flexbox vs Grid：一維 vs 二維

理解這兩者的核心區別：

- **Flexbox** 是一維佈局，隻控製一個方向（行或列）
- **Grid** 是二維佈局，同時控製行和列

實際工作中，**Grid 適合頁面級佈局，Flexbox 適合元件內部對齊**。兩者經常搭配使用。

## 基礎概念

```css
.container {
  display: grid;

  /* 定義列：3 列，各占 1 份 */
  grid-template-columns: 1fr 1fr 1fr;

  /* 定義行：第一行 80px，其餘自動 */
  grid-template-rows: 80px auto;

  /* 網格間距 */
  gap: 16px;
}
```

`fr` 是 Grid 的專屬單位，表示可用空間的分數（fraction）。`1fr 1fr 1fr` 等同於三列等寬，但比 `33.33%` 更靈活——它會自動扣除 gap 後再分配。

## 實作經典的後臺管理佈局

以前實作這種佈局需要大量 hack，用 Grid 非常直觀：

```html
<div class="layout">
  <header class="header">頂部導覽</header>
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

`grid-template-areas` 用視覺化的方式定義佈局，程式碼即設計稿，非常直觀。

## 響應式網格：repeat 和 auto-fill

做響應式卡片網格，不需要寫媒體查詢：

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```

`auto-fill` + `minmax` 的組合效果：

- 每列最小 280px，最大 1fr
- 自動計算能放幾列
- 容器變窄時自動減少列數

這一行 CSS 取代了通常需要寫三四個斷點的響應式程式碼。

## 跨行/跨列

```css
.featured-post {
  /* 橫跨 2 列 */
  grid-column: span 2;

  /* 或者用明確的起止線 */
  grid-column: 1 / 3;
  grid-row: 1 / 2;
}
```

做雜誌風格的卡片瀑布流佈局時這個特性很有用：

```css
.card:nth-child(1) {
  grid-column: 1 / 3; /* 第一張大圖橫跨兩列 */
  grid-row: 1 / 3;
}
```

## 對齊控製

Grid 的對齊屬性比 Flexbox 更全面，因為有兩個軸可以分別控製：

```css
.container {
  /* 所有 grid items 在格子內的對齊 */
  align-items: center; /* 垂直方向 */
  justify-items: start; /* 水平方向 */

  /* 整個 grid 在容器內的對齊（當 grid 小於容器時） */
  align-content: center;
  justify-content: space-between;
}

/* 單個 item 覆蓋預設對齊 */
.special-item {
  align-self: end;
  justify-self: stretch;
}
```

## 什麼時候不用 Grid

Grid 有一定學習成本，不是所有場景都值得用：

- **簡單的水平置中**：用 Flexbox 或 margin auto
- **一行按鈕組**：Flexbox 更簡單
- **需要相容 IE11**：Grid 在 IE 上有獨立的舊語法，實作成本高
- **隻有一個方向的排列**：Flexbox 就夠了

## 瀏覽器支援現狀

截至 2018 年初，全球支援率約 72%。Chrome、Firefox、Safari、Edge 均已支援。IE11 支援舊版語法，需要額外處理。如果你的使用者群以 Chrome 為主（很多 B 端產品是這樣），現在就可以用。

---

_下一篇：React 16 錯誤邊界機製_
