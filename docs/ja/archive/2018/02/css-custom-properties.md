---
title: "CSS カスタムプロパティ（変数）実践ガイド"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 1
description: "CSS カスタムプロパティ（CSS 変数とも呼ばれる）は Sass/Less 変数と根本的に異なります：コンパイル時ではなく、ブラウザで**実行時に**解決されます。これにより、プリプロセッサでは不可能なことが実現できます。"
---

CSS カスタムプロパティ（CSS 変数とも呼ばれる）は Sass/Less 変数と根本的に異なります：コンパイル時ではなく、ブラウザで**実行時に**解決されます。これにより、プリプロセッサでは不可能なことが実現できます。

## 基本構文

```css
/* 定義：-- で始まる必要がある */
:root {
  --primary-color: #4285f4;
  --spacing-md: 16px;
  --border-radius: 4px;
}

/* 使用：var() 関数 */
.button {
  background-color: var(--primary-color);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
}

/* フォールバック値 */
.text {
  color: var(--text-color, #333); /* --text-color が未定義の場合 #333 を使用 */
}
```

## Sass 変数との主な違い

```scss
// Sass：コンパイル時変数 — CSS 出力に固定値として埋め込まれる
$primary: #4285f4;
.button {
  background: $primary;
} // → .button { background: #4285f4; }
// コンパイル後はブラウザで動的に変更できない
```

```javascript
// CSS 変数：ブラウザ上でライブに存在し、実行時に変更可能
document.documentElement.style.setProperty("--primary-color", "#ff5722");
// var(--primary-color) を使用するすべての要素が即座に更新！
```

## ダークモードのテーマ切り替え

```css
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --card-bg: #f5f5f5;
}

[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e0e0e0;
  --card-bg: #2d2d2d;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
}
.card {
  background: var(--card-bg);
}
```

```javascript
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  document.documentElement.setAttribute(
    "data-theme",
    current === "dark" ? "light" : "dark",
  );
}
```

各要素を個別に変更する JavaScript は不要です。1つの属性を変更するだけで CSS 変数を通してページ全体が更新されます。

## コンポーネントレベルの変数

CSS 変数はグローバルな `:root` だけでなく、コンポーネントにスコープを当てることができます：

```css
.card {
  --card-padding: 16px;
  --card-radius: 8px;

  padding: var(--card-padding);
  border-radius: var(--card-radius);
}

/* 使用箇所でオーバーライド */
.product-card {
  --card-padding: 24px;
}
```

## JavaScript からの読み書き

```javascript
// CSS 変数を読み取る
const style = getComputedStyle(document.documentElement);
const primaryColor = style.getPropertyValue("--primary-color").trim();

// 書き込む（この変数を継承するすべての要素に影響）
document.documentElement.style.setProperty("--primary-color", "#ff5722");

// 特定の要素に書き込む（スコープ付き）
element.style.setProperty("--card-bg", "#f0f0f0");
```
