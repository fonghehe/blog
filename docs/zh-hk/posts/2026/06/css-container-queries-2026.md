---
title: "CSS 容器查詢 2026 實戰：響應式組件設計新範式"
date: 2026-06-05 11:34:38
tags:
  - CSS
readingTime: 2
description: "容器查詢已經成為 2026 年響應式設計的主流方案。本文從基礎語法到複雜佈局，系統講解容器查詢在實際項目中的應用模式和最佳實踐。"
wordCount: 375
---

響應式設計從媒體查詢走向容器查詢，是 CSS 發展歷程中的重要轉折點。2026 年，容器查詢的瀏覽器支持率已經超過 95%，在實際項目中的應用也越來越成熟。

## 從媒體查詢到容器查詢

傳統媒體查詢的問題在於它只能感知視口尺寸，無法感知組件自身可用空間：

```css
/* 媒體查詢：基於視口 */
@media (min-width: 768px) {
  .card { display: grid; grid-template-columns: 200px 1fr; }
}
```

容器查詢解決了這個問題——讓組件根據自身容器的尺寸來調整佈局：

```css
/* 容器查詢：基於父容器 */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

## 基礎語法詳解

### 容器類型

`container-type` 有三個值：

```css
/* inline-size：只監聽水平尺寸（最常用） */
.sidebar { container-type: inline-size; }

/* size：同時監聽水平和垂直尺寸 */
.chart-container { container-type: size; }
```

### 命名容器

當頁面有多個容器時，命名容器可以避免查詢衝突：

```css
.page-header { container-type: inline-size; container-name: header; }
.main-content { container-type: inline-size; container-name: content; }

@container header (min-width: 600px) {
  .nav-items { display: flex; gap: 1rem; }
}
```

## 實際應用模式

### 卡片組件響應式

```css
.card-wrapper {
  container-type: inline-size;
}

/* 小容器：垂直佈局 */
@container (max-width: 399px) {
  .card { grid-template-columns: 1fr; }
}

/* 中等容器：水平佈局 */
@container (400px <= width <= 699px) {
  .card { grid-template-columns: 150px 1fr; }
}

/* 大容器：水平佈局，圖片更大 */
@container (min-width: 700px) {
  .card { grid-template-columns: 250px 1fr; }
}
```

### 導航欄響應式

```css
.navbar {
  container-type: inline-size;
  container-name: nav;
}

/* 寬容器：完整導航 */
@container nav (min-width: 768px) {
  .nav-toggle { display: none; }
}

/* 窄容器：漢堡選單 */
@container nav (max-width: 767px) {
  .nav-items { position: fixed; left: -100%; }
  .nav-items.open { left: 0; }
  .nav-toggle { display: block; }
}
```

## 性能優化

1. **避免過度嵌套**：不要在已經很小的容器中再定義容器查詢
2. **合理選擇容器類型**：大多數場景下 `inline-size` 就足夠了
3. **使用 `contain` 屬性**：在容器元素上添加 `contain: layout style` 可以優化渲染性能

## 總結

容器查詢是 CSS 響應式設計的未來方向。它讓組件真正擁有了「自我感知」的能力，能夠根據自身可用空間而不是視口尺寸來調整佈局。掌握容器查詢的關鍵是理解「組件驅動」的響應式思維——不再考慮「視口有多寬」，而是考慮「這個組件有多少空間」。
