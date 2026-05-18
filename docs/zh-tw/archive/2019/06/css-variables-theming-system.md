---
title: "CSS 自定義屬性（變數）實戰"
date: 2019-06-21 10:26:38
tags:
  - CSS
readingTime: 1
description: "CSS 自定義屬性（又叫 CSS 變數）已經被主流瀏覽器支援了，比 Sass 變數更靈活，可以執行時修改。"
---

CSS 自定義屬性（又叫 CSS 變數）已經被主流瀏覽器支援了，比 Sass 變數更靈活，可以執行時修改。

## 基本用法

```css
/* 定義：-- 字首，通常放在 :root */
:root {
  --color-primary: #409eff;
  --color-success: #67c23a;
  --color-danger: #f56c6c;

  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  --border-radius: 4px;
  --font-size-base: 14px;
}

/* 使用：var() 函式 */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
}

/* 帶預設值 */
.card {
  color: var(--card-color, #333); /* 如果 --card-color 未定義，用 #333 */
}
```

## 主題切換（核心場景）

```css
/* 預設主題（亮色） */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --border-color: #e8e8e8;
}

/* 暗色主題 */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e8e8e8;
  --border-color: #333333;
}

/* 元件使用變數，主題切換時自動更新 */
body {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.card {
  border: 1px solid var(--border-color);
  background: var(--bg-color);
}
```

```javascript
// 切換主題
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "light" : "dark",
  );
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

// 初始化（讀取使用者偏好）
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
document.documentElement.setAttribute("data-theme", savedTheme);
```

## 用 JS 動態修改

```javascript
// 讀取變數值
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue("--color-primary")
  .trim();

// 修改變數（立即生效，所有用到這個變數的地方都更新）
document.documentElement.style.setProperty("--color-primary", "#ff6b6b");

// 修改區域性變數
const card = document.querySelector(".card");
card.style.setProperty("--card-bg", "#f5f5f5");
```

## 和 Sass 變數的區別

```scss
// Sass 變數：編譯時處理，最終輸出固定 CSS 值
$primary: #409eff;
.button {
  background: $primary;
} // 編譯後 → background: #409eff;

// 如果要"主題切換"，需要編譯兩套 CSS
```

```css
/* CSS 變數：執行時處理，可以動態修改 */
:root {
  --primary: #409eff;
}
.button {
  background: var(--primary);
}
/* 修改 --primary，所有 .button 立即更新，不需要重新編譯 */
```

兩者可以配合使用：Sass 處理計算邏輯，輸出 CSS 變數。

## 元件級變數

```css
/* 元件可以有自己的變數，外部可以覆蓋 */
.card {
  --card-padding: 16px;
  --card-border-radius: 8px;

  padding: var(--card-padding);
  border-radius: var(--card-border-radius);
}

/* 外部定製 */
.dashboard .card {
  --card-padding: 24px; /* 這個 .card 有更大的 padding */
}
```

## 小結

- CSS 變數執行時生效，可以用 JS 動態修改，比 Sass 變數更靈活
- `:root` 定義全域性變數，元件內定義區域性變數
- `data-theme` 屬性 + CSS 變數 = 零執行時成本的主題切換
- 用 `prefers-color-scheme` 媒體查詢尊重使用者系統主題偏好
