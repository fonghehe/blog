---
title: "響應式設計實踐：從移動優先開始"
date: 2018-05-26 11:18:01
tags:
  - CSS
readingTime: 1
description: "做了好幾個移動端項目，總結一下響應式設計的實踐經驗。"
wordCount: 147
---

做了好幾個移動端項目，總結一下響應式設計的實踐經驗。

## 移動優先（Mobile First）

先寫移動端樣式，然後用 `min-width` 媒體查詢逐步擴展到大屏：

```css
/* ✅ 移動優先 */
.container {
  padding: 16px; /* 默認：手機 */
}

@media (min-width: 768px) {
  .container {
    padding: 24px; /* 平板 */
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px; /* 桌面 */
  }
}

/* ❌ 桌面優先（不推薦，移動端要覆蓋太多東西）*/
.container {
  max-width: 1200px;
  margin: 0 auto;
}

@media (max-width: 767px) {
  .container {
    max-width: 100%;
    padding: 16px;
  }
}
```

## 斷點規劃

```css
/* 常見斷點（和主流設備對齊）*/
/* 手機：< 576px（默認，不需要媒體查詢）*/
/* 大手機/小平板：≥ 576px */
/* 平板：≥ 768px */
/* 小桌面：≥ 992px */
/* 大桌面：≥ 1200px */

:root {
  --breakpoint-sm: 576px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 992px;
  --breakpoint-xl: 1200px;
}
```

## Flexbox 響應式

```css
.card-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card {
  /* 手機：一行一個 */
  flex: 1 1 100%;
}

@media (min-width: 576px) {
  .card {
    /* 平板：一行兩個 */
    flex: 1 1 calc(50% - 8px);
  }
}

@media (min-width: 992px) {
  .card {
    /* 桌面：一行三個 */
    flex: 1 1 calc(33.333% - 11px);
  }
}
```

## Grid 響應式（更推薦）

```css
.card-list {
  display: grid;
  /* 自動響應，不需要媒體查詢 */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

## 圖片響應式

```html
<!-- srcset：根據 DPR 選擇圖片 -->
<img src="image.jpg" srcset="image.jpg 1x, image@2x.jpg 2x" alt="圖片" />

<!-- sizes + srcset：根據視口寬度選擇圖片 -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 576px) 100vw, (max-width: 992px) 50vw, 33vw"
  alt="圖片"
/>

<!-- picture：不同設備不同圖片 -->
<picture>
  <source media="(max-width: 576px)" srcset="mobile.jpg" />
  <source media="(max-width: 992px)" srcset="tablet.jpg" />
  <img src="desktop.jpg" alt="圖片" />
</picture>
```

## 字體響應式

```css
/* 傳統方式：媒體查詢 */
h1 {
  font-size: 24px;
}
@media (min-width: 768px) {
  h1 {
    font-size: 32px;
  }
}
@media (min-width: 1200px) {
  h1 {
    font-size: 48px;
  }
}

/* 現代方式：clamp()（響應式且流暢）*/
h1 {
  /* 最小 24px，最大 48px，中間線性插值 */
  font-size: clamp(24px, 4vw, 48px);
}
```

## 測試響應式

```
1. Chrome DevTools：手機模擬器，選各種設備尺寸
2. 實際設備測試：尤其是 iOS Safari（和 Chrome 渲染差異大）
3. 測試斷點臨界值（767px、768px）
4. 測試橫屏狀態
```

## 小結

- 移動優先：從小屏開始寫，用 `min-width` 擴展
- 斷點選 576/768/992/1200（和主流框架對齊）
- Grid 的 `auto-fill + minmax` 比 Flex 更省媒體查詢
- 圖片用 `srcset`，字體用 `clamp()`
- 必須在真實設備上測試 iOS Safari