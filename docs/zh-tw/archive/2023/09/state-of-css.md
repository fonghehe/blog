---
title: "State of CSS 2023：容器查詢、巢狀與色彩函式全面落地"
date: 2023-09-22 17:22:14
tags:
  - CSS
readingTime: 2
description: "State of CSS 2023 調查結果於 2023 年釋出，資料來自全球 9,000+ 開發者。今年的主旋律是\"等了很久的特性終於可以用了\"：Container Queries、原生 CSS 巢狀、`:has()` 選擇器、`color-mix()` 等在各大瀏覽器的支援度都突破了 85%，進入實際可用區間。"
wordCount: 393
---

State of CSS 2023 調查結果於 2023 年釋出，資料來自全球 9,000+ 開發者。今年的主旋律是"等了很久的特性終於可以用了"：Container Queries、原生 CSS 巢狀、`:has()` 選擇器、`color-mix()` 等在各大瀏覽器的支援度都突破了 85%，進入實際可用區間。

## 容器查詢（Container Queries）：真正的元件級響應式

終於不用依賴視口寬度做響應式了。`@container` 讓元件可以根據自身容器的大小調整樣式：

```css
/* 定義容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 容器查詢 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

```html
<!-- 同一組件在不同容器中自動適應 -->
<aside class="narrow-sidebar">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 豎向佈局 -->
  </div>
</aside>

<main class="wide-content">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 橫向網格佈局 -->
  </div>
</main>
```

**容器查詢單位（cqw/cqh）**：

```css
.responsive-text {
  font-size: clamp(14px, 4cqw, 24px); /* 字型隨容器寬度變化 */
}
```

## 原生 CSS 巢狀：告別前處理器的核心理由

Baseline 2023，Chrome 112+、Safari 16.5+、Firefox 117+ 全部支援：

```css
/* 原生 CSS 巢狀（2023 年穩定） */
.button {
  background: #0066ff;
  color: white;
  padding: 8px 16px;

  &:hover {
    background: #0052cc;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 巢狀媒體查詢 */
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 14px;
  }

  /* 巢狀容器查詢 */
  @container (min-width: 400px) {
    padding: 12px 24px;
  }
}
```

## :has() 選擇器：實現了"父選擇器"

```css
/* 含有 img 的 card 顯示特殊樣式 */
.card:has(img) {
  padding: 0;
  overflow: hidden;
}

/* 含有 required 輸入框的 form-group 顯示必填標記 */
.form-group:has(input:required) .label::after {
  content: " *";
  color: red;
}

/* 父選擇器用途：選中包含 :checked input 的 li */
li:has(input:checked) {
  background: #e8f5e9;
  font-weight: bold;
}

/* 當表格有超過 5 列時，調整單元格內邊距 */
table:has(th:nth-child(5)) td {
  padding: 4px 8px; /* 列多時縮小內邊距 */
}
```

## color-mix()：CSS 原生顏色混合

```css
:root {
  --primary: #0066ff;
  --primary-hover: color-mix(in srgb, var(--primary) 85%, black); /* 深15% */
  --primary-light: color-mix(in srgb, var(--primary) 20%, white); /* 淺80% */
  --primary-transparent: color-mix(in srgb, var(--primary) 60%, transparent);
}

.button {
  background: var(--primary);

  &:hover {
    background: var(--primary-hover); /* 自動計算懸停顏色 */
  }
}

.badge {
  background: var(--primary-light);
  border: 1px solid var(--primary);
}
```

## CSS 相對顏色語法（更強大的顏色計算）

```css
:root {
  --accent: hsl(200deg 80% 50%);
}

.variant-dark {
  /* 從 --accent 派生，隻改亮度 */
  background: hsl(from var(--accent) h s calc(l - 15%));
}

.variant-muted {
  /* 降低飽和度 */
  background: hsl(from var(--accent) h calc(s - 40%) l);
}
```

## CSS 級聯層（@layer）：解決特異性大戰

```css
/* 按優先順序從低到高宣告層級 */
@layer reset, base, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer base {
  a {
    color: inherit;
  }
  button {
    cursor: pointer;
  }
}

@layer components {
  .card {
    /* 元件樣式 */
  }
}

@layer utilities {
  .text-center {
    text-align: center !important;
  }
}

/* 不在任何層的樣式總是勝過層內樣式 */
.critical {
  color: red;
} /* 優先順序最高，無需 !important */
```

## 2023 年 State of CSS 調查亮點資料

- **容器查詢知曉率**：91%，使用率從 2022 年的 19% 躍升至 42%
- **`:has()`**：知曉率 72%，使用率 38%（第一年全面支援就有這麼高使用率）
- **原生巢狀**：知曉率 87%，使用率 35%
- **最想要的新特性**：`if()` 函式（CSS 條件值）排名第一

## 總結

2023 年是 CSS 的"收割年"——等待了數年的特性終於全面可用。Container Queries 讓元件真正自包含，`:has()` 實現了長期缺失的父選擇器能力，原生巢狀讓 CSS 可讀性大幅提升。對於仍在大量使用 SCSS 的專案，2023 年是評估"是否還需要前處理器"的好時機。