---
title: "CSSカスタムプロパティの高度な活用法"
date: 2019-05-15 11:24:19
tags:
  - CSS
readingTime: 1
description: "CSSカスタムプロパティ（CSS変数とも呼ばれます）はモダンブラウザで完全にサポートされています。多くの人はカラー変数の定義にしか使っていませんが、その能力はそれをはるかに超えています。本記事ではCSSカスタムプロパティの高度な活用法と実践的なテクニックを紹介します。"
---

CSSカスタムプロパティ（CSS変数とも呼ばれます）はモダンブラウザで完全にサポートされています。多くの人はカラー変数の定義にしか使っていませんが、その能力はそれをはるかに超えています。本記事ではCSSカスタムプロパティの高度な活用法と実践的なテクニックを紹介します。

## 基本のおさらい

```css
/* 宣言：必ず--で始める */
:root {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --font-size-base: 16px;
  --spacing-unit: 8px;
  --border-radius: 4px;
  --transition-speed: 0.3s;
}

/* 使用：var()関数を通じて */
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

## フォールバック値

`var()`関数は第2引数としてデフォルト値をサポートします。

```css
/* --primary-colorが未定義の場合、#3498dbを使用 */
.element {
  color: var(--primary-color, #3498db);
}

/* フォールバックはネストできる */
.element {
  /* まず--primary-color、なければ--brand-color、それもなければred */
  color: var(--primary-color, var(--brand-color, red));
}

/* 実践：コンポーネントライブラリのデフォルト値設計 */
.card {
  --card-bg: var(--card-background, #ffffff);
  --card-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  --card-radius: var(--border-radius, 8px);

  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  border-radius: var(--card-radius);
}

/* 必要に応じてオーバーライド、またはデフォルトを使用 */
.promo-card {
  --card-background: #fffbe6;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

## calc()と変数の組み合わせ

これはCSSカスタムプロパティの最も強力な特性の一つです。

```css
:root {
  --base-size: 16px;
  --scale-ratio: 1.25;
  --spacing: 8px;
  --column-count: 12;
}

/* calc()を使ったタイプスケール */
h1 {
  font-size: calc(
    var(--base-size) * var(--scale-ratio) * var(--scale-ratio) *
      var(--scale-ratio)
  );
}
h2 {
  font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio));
}
h3 {
  font-size: calc(var(--base-size) * var(--scale-ratio));
}

/* グリッドシステム */
.col-6 {
  width: calc(6 / var(--column-count) * 100%);
}
.col-4 {
  width: calc(4 / var(--column-count) * 100%);
}
```

CSSカスタムプロパティはライブな値です——JavaScriptでランタイムに更新でき、強力な動的テーミングやアニメーションの可能性を開きます。
