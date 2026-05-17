---
title: "CSSカスタムプロパティ（変数）実践"
date: 2019-06-21 10:26:38
tags:
  - CSS
readingTime: 1
description: "CSSカスタムプロパティ（CSS変数とも呼ばれます）は主要ブラウザでサポートされています。Sass変数より柔軟で、ランタイムに更新できます。"
---

CSSカスタムプロパティ（CSS変数とも呼ばれます）は主要ブラウザでサポートされています。Sass変数より柔軟で、ランタイムに更新できます。

## 基本的な使い方

```css
/* 宣言：--プレフィックス、通常は:rootに */
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

/* 使用：var()関数 */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
}

/* デフォルト値あり */
.card {
  color: var(--card-color, #333); /* --card-colorが未定義の場合、#333を使用 */
}
```

## テーマ切り替え（コアユースケース）

```css
/* デフォルトテーマ（ライト） */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --border-color: #e8e8e8;
}

/* ダークテーマ */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e8e8e8;
  --border-color: #333333;
}

/* コンポーネントが変数を使用——テーマ切り替え時に自動更新 */
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
// テーマ切り替え
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "light" : "dark",
  );
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

// 初期化（ユーザー設定を読み取り）
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
document.documentElement.setAttribute("data-theme", savedTheme);
```

## JavaScriptで変数を更新

```javascript
// グローバルにCSS変数を設定
document.documentElement.style.setProperty("--primary-color", "#ff6b6b");

// 特定の要素に設定
element.style.setProperty("--card-width", "300px");

// CSS変数の値を読み取り
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();
```

CSSカスタムプロパティはCSSとJavaScriptを真に橋渡しできる数少ないCSS機能の一つです——動的テーミング、コンポーネントのカスタマイズ、ランタイムでのデザイントークン更新に活用しましょう。
