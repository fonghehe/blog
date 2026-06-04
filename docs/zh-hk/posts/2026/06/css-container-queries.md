---
title: "CSS 容器查詢 2026 實戰：組件級響應式設計"
date: 2026-06-04 16:38:53
tags:
  - CSS
readingTime: 2
description: "容器查詢讓組件能夠根據自身容器的尺寸調整佈局，而不是依賴視口寬度。本文討論 2026 年容器查詢的實戰用法、常見陷阱和與 Grid、Flex 的配合策略。"
wordCount: 389
---

CSS 容器查詢（Container Queries）是響應式設計的一次範式轉變。傳統的媒體查詢基於視口寬度，但組件在實際使用中往往不知道自己會被放在多寬的容器裡。容器查詢解決了這個問題——讓組件根據「自己的環境」來調整樣式。

## 基礎語法

容器查詢的核心是兩個屬性：`container-type` 和 `@container`：

```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}
```

`container-type` 有三個值：
- `inline-size`：只監聽行內方向的尺寸變化（最常用）
- `size`：同時監聽行內和塊方向
- `normal`：不作為容器查詢的目標

## 容器查詢 vs 媒體查詢

| 場景 | 推薦方案 | 原因 |
|------|---------|------|
| 頁面整體佈局 | 媒體查詢 | 視口寬度決定整體佈局 |
| 卡片組件 | 容器查詢 | 卡片在不同容器中寬度不同 |
| 導航欄 | 媒體查詢 | 通常受視口寬度控制 |
| 表單組件 | 容器查詢 | 表單可能在側邊欄或主內容區 |

## 實際案例：自適應卡片

```css
.card-wrapper {
  container-type: inline-size;
}

/* 窄容器：垂直佈局 */
@container (max-width: 300px) {
  .card { flex-direction: column; }
}

/* 中等容器：水平佈局 */
@container (min-width: 301px) and (max-width: 600px) {
  .card { flex-direction: row; }
  .card-image { width: 120px; flex-shrink: 0; }
}

/* 寬容器：水平佈局，圖片更大 */
@container (min-width: 601px) {
  .card { flex-direction: row; }
  .card-image { width: 200px; flex-shrink: 0; }
}
```

## 容器查詢單位

```css
.card-title {
  font-size: clamp(1rem, 3cqi, 1.5rem);
}
```

單位列表：
- `cqw`：容器寬度的 1%
- `cqh`：容器高度的 1%
- `cqi`：容器行內尺寸的 1%
- `cqb`：容器塊尺寸的 1%

## 常見陷阱

**陷阱 1：忘記設置 container-type**

```css
/* 錯誤：沒有聲明容器類型 */
.sidebar { width: 300px; }

@container (min-width: 400px) {
  .sidebar .widget { /* 這條規則不會生效 */ }
}
```

## 漸進增強策略

```css
/* 基礎樣式（不依賴容器查詢） */
.card { display: flex; flex-direction: column; }

/* 容器查詢增強 */
@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## 總結

容器查詢讓組件真正實現了「自適應」，不再依賴視口寬度。它是響應式設計的最後一塊拼圖——頁面佈局用媒體查詢，組件內部用容器查詢。配合 Grid 和 Flex，可以構建出真正靈活的組件系統。
