---
title: "CSS Custom Properties 高級用法：落地路徑與實戰建議"
date: 2019-05-15 11:24:19
tags:
  - CSS
readingTime: 4
description: "CSS Custom Properties（也叫 CSS Variables）已經得到現代瀏覽器的全面支援。很多人隻知道它能定義顏色變量，但它的能力遠不止於此。這篇文章介紹 CSS Custom Properties 的高級用法和實戰技巧。"
wordCount: 378
---

CSS Custom Properties（也叫 CSS Variables）已經得到現代瀏覽器的全面支援。很多人隻知道它能定義顏色變量，但它的能力遠不止於此。這篇文章介紹 CSS Custom Properties 的高級用法和實戰技巧。

## 基礎回顧

```css
/* 聲明：必須以 -- 開頭 */
:root {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --font-size-base: 16px;
  --spacing-unit: 8px;
  --border-radius: 4px;
  --transition-speed: 0.3s;
}

/* 使用：通過 var() 函數 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3);
  border-radius: var(--border-radius);
  transition: background-color var(--transition-speed) ease;
}

.button:hover {
  background-color: var(--primary-dark);
}
```

## fallback 值

`var()` 函數支援第二個參數作為默認值。

```css
/* 如果 --primary-color 未定義，使用 #3498db */
.element {
  color: var(--primary-color, #3498db);
}

/* fallback 可以嵌套 */
.element {
  /* 先嚐試 --primary-color，沒有就用 --brand-color，再沒有就用紅色 */
  color: var(--primary-color, var(--brand-color, red));
}

/* 實戰：組件庫的默認值設計 */
.card {
  --card-bg: var(--card-background, #ffffff);
  --card-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  --card-radius: var(--border-radius, 8px);

  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  border-radius: var(--card-radius);
}

/* 使用時可以覆蓋，也可以不覆蓋用默認值 */
.promo-card {
  --card-background: #fffbe6;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

## calc() 與變量組合

這是 CSS Custom Properties 最強大的特性之一。

```css
:root {
  --base-size: 16px;
  --scale-ratio: 1.25;
  --spacing: 8px;
  --column-count: 12;
  --container-max: 1200px;
}

/* 排版系統：用一個 base 和 ratio 生成完整的字號階梯 */
.heading-1 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio)); }
.heading-2 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio)); }
.heading-3 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio)); }
.body-text { font-size: var(--base-size); }
.small-text { font-size: calc(var(--base-size) / var(--scale-ratio)); }

/* 間距系統 */
.container {
  padding: calc(var(--spacing) * 3);
  margin-bottom: calc(var(--spacing) * 2);
  max-width: var(--container-max);
}

/* 柵格系統 */
.column {
  /* 每列寬度 = (容器最大寬度 - (列數+1) * 間距) / 列數 */
  width: calc(
    (var(--container-max) - (var(--column-count) + 1) * var(--spacing)) /
    var(--column-count)
  );
  margin-right: var(--spacing);
}

.column:last-child {
  margin-right: 0;
}

/* 混合單位計算 */
.hero {
  /* 100vh 減去 80px 的頭部高度 */
  min-height: calc(100vh - 80px);
  /* 用變量替代固定值 */
  --header-height: 80px;
  min-height: calc(100vh - var(--header-height));
}

/* 百分比 + 像素混合 */
.sidebar {
  --sidebar-width: 250px;
  --content-gap: 24px;
  width: var(--sidebar-width);
}

.content {
  /* 計算剩餘寬度 */
  width: calc(100% - var(--sidebar-width) - var(--content-gap));
  margin-left: var(--content-gap);
}
```

## 主題切換

最實用的場景：暗色主題。

```css
/* 淺色主題（默認） */
:root {
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --color-primary: #3498db;
  --color-success: #27ae60;
  --color-warning: #f39c12;
  --color-danger: #e74c3c;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* 暗色主題 */
[data-theme="dark"] {
  --color-bg: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-text: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-border: #333355;
  --color-primary: #5dade2;
  --color-success: #58d68d;
  --color-warning: #f5b041;
  --color-danger: #ec7063;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.25);
}

/* 組件隻需使用變量，不需要關心當前主題 */
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  border-radius: 8px;
}

.card-title {
  color: var(--color-text);
}

.card-description {
  color: var(--color-text-secondary);
}

.alert-success {
  background-color: var(--color-success);
  color: #fff;
  padding: 12px 16px;
  border-radius: 4px;
}

.alert-danger {
  background-color: var(--color-danger);
  color: #fff;
  padding: 12px 16px;
  border-radius: 4px;
}
```

配合 JavaScript 切換：

```javascript
// 切換主題
function toggleTheme() {
  const html = document.documentElement
  const current = html.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  html.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

// 初始化：讀取本地存儲或系統偏好
function initTheme() {
  const saved = localStorage.getItem('theme')
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

initTheme()
```

## 通過 JavaScript 讀寫變量

CSS Custom Properties 可以在 JavaScript 中讀寫，這打通了 CSS 和 JS 的橋樑。

```javascript
// 讀取變量值
const root = getComputedStyle(document.documentElement)
const primaryColor = root.getPropertyValue('--primary-color').trim()
console.log(primaryColor) // '#3498db'

// 設置變量值
document.documentElement.style.setProperty('--primary-color', '#e74c3c')

// 刪除變量
document.documentElement.style.removeProperty('--primary-color')

// 作用於特定元素
const card = document.querySelector('.card')
card.style.setProperty('--card-bg', '#fffbe6')

// 實戰：動態修改間距系統
function updateSpacing(baseSpacing) {
  document.documentElement.style.setProperty('--spacing-unit', `${baseSpacing}px`)
}

// 實戰：運行時調整字號（無障礙功能）
function increaseFontSize() {
  const root = getComputedStyle(document.documentElement)
  const current = parseFloat(root.getPropertyValue('--base-font-size'))
  document.documentElement.style.setProperty('--base-font-size', `${current + 2}px`)
}

// 實戰：從 CSS 讀值到 JS 使用
function getThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    bg: styles.getPropertyValue('--color-bg').trim(),
    text: styles.getPropertyValue('--color-text').trim(),
    primary: styles.getPropertyValue('--color-primary').trim()
  }
}
```

## 作用域與繼承

CSS Custom Properties 遵循 CSS 的級聯和繼承規則，這是它的獨特優勢。

```css
/* 全局變量 */
:root {
  --color: blue;
  --font-size: 16px;
}

/* 局部覆蓋 */
.sidebar {
  --color: green;
  --font-size: 14px;
}

/* .sidebar 內部的所有元素繼承綠色 */
.sidebar p {
  color: var(--color); /* green */
  font-size: var(--font-size); /* 14px */
}

/* 更深層的覆蓋 */
.sidebar .special {
  --color: red;
  color: var(--color); /* red */
}

/* 組件級別的變量：BEM + Custom Properties */
/* BEM 命名 + Custom Properties 是很好的組合 */
.button {
  --btn-padding: 10px 20px;
  --btn-bg: var(--primary-color);
  --btn-color: #ffffff;
  --btn-radius: 4px;

  padding: var(--btn-padding);
  background: var(--btn-bg);
  color: var(--btn-color);
  border-radius: var(--btn-radius);
}

.button--large {
  --btn-padding: 14px 28px;
  --btn-radius: 6px;
}

.button--danger {
  --btn-bg: #e74c3c;
}

.button--outline {
  --btn-bg: transparent;
  --btn-color: var(--primary-color);
  border: 2px solid var(--btn-bg);
}
```

## 響應式設計

結合媒體查詢使用變量。

```css
:root {
  --container-padding: 16px;
  --grid-columns: 4;
  --font-size-base: 14px;
  --sidebar-width: 240px;
}

/* 平板 */
@media (min-width: 768px) {
  :root {
    --container-padding: 24px;
    --grid-columns: 8;
    --font-size-base: 15px;
  }
}

/* 桌面 */
@media (min-width: 1024px) {
  :root {
    --container-padding: 32px;
    --grid-columns: 12;
    --font-size-base: 16px;
    --sidebar-width: 280px;
  }
}

/* 大屏 */
@media (min-width: 1440px) {
  :root {
    --container-padding: 48px;
    --sidebar-width: 320px;
  }
}

/* 使用變量的組件會自動適應斷點 */
.page {
  padding: var(--container-padding);
  font-size: var(--font-size-base);
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), 1fr);
  gap: calc(var(--container-padding) / 2);
}

.sidebar {
  width: var(--sidebar-width);
}
```

## 實用技巧

### 透明度變體

```css
:root {
  --primary-color: 52, 152, 219; /* RGB 值，不帶 rgb() */
}

.element {
  background-color: rgb(var(--primary-color));
  /* 通過 rgba 實現透明度變體，不需要額外定義變量 */
  border-color: rgba(var(--primary-color), 0.3);
  box-shadow: 0 2px 8px rgba(var(--primary-color), 0.2);
}

.hover-state {
  background-color: rgba(var(--primary-color), 0.1);
}
```

### 動畫控製

```css
:root {
  /* 用變量控製動畫 */
  --animation-duration: 0.3s;
  --animation-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-in {
  animation: fadeIn var(--animation-duration) var(--animation-easing);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 全局調整動畫速度（比如用户偏好減少動畫） */
@media (prefers-reduced-motion: reduce) {
  :root {
    --animation-duration: 0.01s;
  }
}
```

### CSS 自定義屬性與 Grid

```css
:root {
  --grid-gap: 16px;
  --card-min-width: 280px;
}

.auto-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--card-min-width), 1fr)
  );
  gap: var(--grid-gap);
}

/* 不同區域覆蓋最小寬度 */
.featured-grid {
  --card-min-width: 360px;
}
```

### 條件樣式（利用無效值）

```css
/* 當 --icon-url 有值時顯示圖標，沒有時隱藏 */
.icon {
  background-image: var(--icon-url, none);
  background-size: contain;
  width: var(--icon-size, 24px);
  height: var(--icon-size, 24px);
}

/* 使用時 */
.search-input {
  --icon-url: url('search.svg');
  --icon-size: 20px;
}
```

## 小結

- CSS Custom Properties 遵循級聯和繼承規則，天然適合主題系統和組件化開發
- `calc()` 與變量組合能實現響應式的排版系統和柵格佈局
- 通過 JavaScript 讀寫變量，打通了 CSS 和 JS 的橋樑
- 用 fallback 值和作用域特性實現組件庫的默認值設計
- 拆分 RGB 值到變量中，用 `rgba()` 實現透明度變體，減少變量數量
- 在 `:root` 上結合媒體查詢改變變量值，讓所有引用該變量的樣式自動適應斷點
