---
title: "CSS @starting-style"
date: 2024-10-31 10:00:00
tags:
  - CSS
readingTime: 1
description: "CSS @starting-style是前端開發中一個值得關注的話題。本文從實際專案經驗出發，探討其核心概念和最佳實踐。"
---

CSS @starting-style是前端開發中一個值得關注的話題。本文從實際專案經驗出發，探討其核心概念和最佳實踐。

## 基礎概念

來看具體的實現方式：

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

這種實現方式簡潔高效，適合大多數場景。

## 核心實現

下面是一個實際的示例：

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

在實際專案中，還需要根據具體需求做適當調整。

## 實戰應用

核心程式碼如下：

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

注意處理好邊界條件和異常情況。

## 最佳實踐

我們可以這樣實現：

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

通過這種模式，程式碼的可維護性得到了提升。

## 小結

- CSS @starting-style的核心在於理解底層原理，而非僅僅記住 API
- 在實際專案中，選擇合適的方案比追求最新技術更重要
- 團隊協作中保持程式碼風格一致，降低維護成本
