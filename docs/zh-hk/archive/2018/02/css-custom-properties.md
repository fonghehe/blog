---
title: "CSS 自定義屬性（變量）實踐指南"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 2
description: "CSS 自定義屬性（也叫 CSS 變量）現在主流瀏覽器都支持了，IE 除外。它和 Sass 變量不一樣，有自己獨特的優勢，值得認真瞭解。"
wordCount: 429
---

CSS 自定義屬性（也叫 CSS 變量）現在主流瀏覽器都支持了，IE 除外。它和 Sass 變量不一樣，有自己獨特的優勢，值得認真瞭解。

## 基礎語法

```css
/* 定義變量：以 -- 開頭 */
:root {
  --primary-color: #409eff;
  --font-size-base: 14px;
  --spacing-md: 16px;
}

/* 使用變量：var() 函數 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
}

/* 可以提供默認值 */
.text {
  color: var(--text-color, #333); /* --text-color 未定義時用 #333 */
}
```

## 和 Sass 變量的本質區別

Sass 變量是編譯時的，編譯後就消失了：

```scss
// Sass 變量
$primary: #409eff;
.btn {
  color: $primary;
}

// 編譯後
.btn {
  color: #409eff;
}
// 變量不存在於運行時，無法動態改變
```

CSS 變量存在於運行時：

```css
/* CSS 變量在運行時存在，可以動態修改 */
:root { --primary: #409eff; }
.btn { color: var(--primary); }

/* JavaScript 可以修改 */
document.documentElement.style.setProperty('--primary', '#67c23a')
/* 頁面上所有用 var(--primary) 的地方立即更新 */
```

這是 CSS 變量最大的優勢：**支持運行時動態修改**。

## 應用場景 1：主題切換

以前實現主題切換，要麼預編譯多套 CSS，要麼用 JS 替換 class。CSS 變量簡化了很多：

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

/* 所有組件只用變量，不寫具體顏色 */
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

響應式佈局裏，間距隨屏幕變化：

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

## 應用場景 3：組件級變量（局部作用域）

CSS 變量遵循 CSS 繼承規則，可以在組件內覆蓋：

```css
/* 全局默認 */
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

這種模式特別適合組件庫的主題定製：

```css
/* 使用者可以覆蓋組件的默認樣式變量 */
.my-app {
  --el-color-primary: #722ed1; /* 自定義 Element UI 主題色 */
}
```

## 與 Sass 配合使用

實際項目裏可以兩者結合：Sass 負責編譯時的邏輯（循環、條件、函數），CSS 變量負責運行時動態性。

```scss
// 用 Sass 批量生成 CSS 變量
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

## JavaScript 讀寫 CSS 變量

```javascript
// 讀取
const value = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// 設置
document.documentElement.style.setProperty("--primary-color", "#67c23a");

// 刪除（恢復繼承的值）
document.documentElement.style.removeProperty("--primary-color");

// 在組件內局部設置
element.style.setProperty("--button-size", "32px");
```

## 瀏覽器支持

截至 2018 年初，主流瀏覽器都已支持：Chrome 49+、Firefox 31+、Safari 9.1+、Edge 15+。唯獨 IE 不支持。

如果需要支持 IE，可以用 `postcss-custom-properties` 在編譯時將變量替換為具體值（失去動態能力，但保證兼容性）。

## 小結

- CSS 變量的核心價值是**運行時動態**，這是 Sass 變量做不到的
- 主題切換、響應式設計、組件主題定製是最佳應用場景
- 變量有作用域，在子元素內可以覆蓋父元素的變量值
- 配合 JavaScript `setProperty` 實現真正的動態主題