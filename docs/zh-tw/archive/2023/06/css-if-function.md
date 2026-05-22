---
title: "CSS if() 函式提案 2023：条件邏輯進入 CSS 的早期讨論"
date: 2023-06-13 11:13:59
tags:
  - CSS
readingTime: 1
description: "CSS if() 函式提案在近年來發展迅速，本文將深入分析其原理和實踐方法。"
wordCount: 232
---

CSS if() 函式提案在近年來發展迅速，本文將深入分析其原理和實踐方法。

## 基礎概念

具體用法參考以下程式碼：

```css
:root {
  --primary: #2563eb;
  --surface: #f8fafc;
  --text: #1e293b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.component {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1rem, 3vw, 2rem);
  color: var(--text);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1e293b;
    --text: #f1f5f9;
  }
}

```

建議在團隊中統一規範，減少不一致的問題。

## 核心實現

來看具體的實現方式：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  container-type: inline-size;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

@container (min-width: 400px) {
  .card__body {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

```

這種實現方式簡潔高效，適合大多數場景。

## 實戰應用

下面是一個實際的示例：

```css
:root {
  --primary: #2563eb;
  --surface: #f8fafc;
  --text: #1e293b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.component {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1rem, 3vw, 2rem);
  color: var(--text);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1e293b;
    --text: #f1f5f9;
  }
}

```

在實際專案中，還需要根據具體需求做適當調整。

## 最佳實踐

核心程式碼如下：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  container-type: inline-size;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

@container (min-width: 400px) {
  .card__body {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

```

注意處理好邊界條件和異常情況。

## 小結

- 效能最佳化需要基於實際資料，避免過度最佳化
- CSS if() 函式提案的核心在於理解底層原理，而非僅僅記住 API
- 在實際專案中，選擇合適的方案比追求最新技術更重要