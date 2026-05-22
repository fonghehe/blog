---
title: "CSS 自定義屬性（變數）進階：主題切換與動態樣式"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 2
description: "CSS 自定義屬性（也叫 CSS 變數）現在主流瀏覽器都支援了，IE 除外。它和 Sass 變數不一樣，有自己獨特的優勢，值得認真瞭解。"
wordCount: 430
---

CSS 自定義屬性（也叫 CSS 變數）現在主流瀏覽器都支援了，IE 除外。它和 Sass 變數不一樣，有自己獨特的優勢，值得認真瞭解。

## 基礎語法

```css
/* 定義變數：以 -- 開頭 */
:root {
  --primary-color: #409eff;
  --font-size-base: 14px;
  --spacing-md: 16px;
}

/* 使用變數：var() 函式 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
}

/* 可以提供預設值 */
.text {
  color: var(--text-color, #333); /* --text-color 未定義時用 #333 */
}
```

## 和 Sass 變數的本質區別

Sass 變數是編譯時的，編譯後就消失了：

```scss
// Sass 變數
$primary: #409eff;
.btn {
  color: $primary;
}

// 編譯後
.btn {
  color: #409eff;
}
// 變數不存在於執行時，無法動態改變
```

CSS 變數存在於執行時：

```css
/* CSS 變數在執行時存在，可以動態修改 */
:root { --primary: #409eff; }
.btn { color: var(--primary); }

/* JavaScript 可以修改 */
document.documentElement.style.setProperty('--primary', '#67c23a')
/* 頁面上所有用 var(--primary) 的地方立即更新 */
```

這是 CSS 變數最大的優勢：**支援執行時動態修改**。

## 應用場景 1：主題切換

以前實現主題切換，要麼預編譯多套 CSS，要麼用 JS 替換 class。CSS 變數簡化了很多：

```css
/* 定義主題 */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --primary: #409eff;
}

[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --primary: #64b5f6;
}

/* 所有元件隻用變數，不寫具體顏色 */
body {
  background: var(--bg-color);
  color: var(--text-color);
}
```

```javascript
// 切換主題
document.documentElement.setAttribute("data-theme", "dark");
document.documentElement.setAttribute("data-theme", "light");
```

## 應用場景 2：動態間距/尺寸

響應式佈局裡，間距隨螢幕變化：

```css
:root {
  --spacing: 16px;
}

@media (max-width: 768px) {
  :root {
    --spacing: 8px;
  }
}

.card {
  padding: var(--spacing);
  margin-bottom: var(--spacing);
}

.card-header {
  padding: calc(var(--spacing) / 2) var(--spacing);
}
```

## 應用場景 3：元件級變數（區域性作用域）

CSS 變數遵循 CSS 繼承規則，可以在元件內覆蓋：

```css
/* 全域性預設 */
:root {
  --button-bg: #409eff;
  --button-radius: 4px;
}

/* 在特定上下文內覆蓋 */
.danger-zone {
  --button-bg: #f56c6c;
}

/* 所有在 .danger-zone 內的按鈕都會用紅色背景 */
.button {
  background: var(--button-bg);
  border-radius: var(--button-radius);
}
```

這種模式特別適合元件庫的主題定製：

```css
/* 使用者可以覆蓋元件的預設樣式變數 */
.my-app {
  --el-color-primary: #722ed1; /* 自定義 Element UI 主題色 */
}
```

## 與 Sass 配合使用

實際專案裡可以兩者結合：Sass 負責編譯時的邏輯（迴圈、條件、函式），CSS 變數負責執行時動態性。

```scss
// 用 Sass 批次生成 CSS 變數
$colors: (
  "primary": #409eff,
  "success": #67c23a,
  "warning": #e6a23c,
  "danger": #f56c6c,
);

:root {
  @each $name, $value in $colors {
    --color-#{$name}: #{$value};
  }
}
```

## JavaScript 讀寫 CSS 變數

```javascript
// 讀取
const value = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// 設定
document.documentElement.style.setProperty("--primary-color", "#67c23a");

// 刪除（恢復繼承的值）
document.documentElement.style.removeProperty("--primary-color");

// 在元件內區域性設定
element.style.setProperty("--button-size", "32px");
```

## 瀏覽器支援

截至 2018 年初，主流瀏覽器都已支援：Chrome 49+、Firefox 31+、Safari 9.1+、Edge 15+。唯獨 IE 不支援。

如果需要支援 IE，可以用 `postcss-custom-properties` 在編譯時將變數替換為具體值（失去動態能力，但保證相容性）。

## 小結

- CSS 變數的核心價值是**執行時動態**，這是 Sass 變數做不到的
- 主題切換、響應式設計、元件主題定製是最佳應用場景
- 變數有作用域，在子元素內可以覆蓋父元素的變數值
- 配合 JavaScript `setProperty` 實現真正的動態主題