---
title: "CSS 自定义属性（变量）応用：主题切换与动态样式"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 3
description: "CSS カスタムプロパティ（CSS 変数とも呼ばれる）は現在、IE を除くすべての主要ブラウザでサポートされています。Sass 変数とは異なる独自の利点があり、しっかり理解する価値があります。"
wordCount: 645
---

CSS カスタムプロパティ（CSS 変数とも呼ばれる）は現在、IE を除くすべての主要ブラウザでサポートされています。Sass 変数とは異なる独自の利点があり、しっかり理解する価値があります。

## 基本構文

```css
/* 変数の定義：-- で始まる */
:root {
  --primary-color: #409eff;
  --font-size-base: 14px;
  --spacing-md: 16px;
}

/* 変数の使用：var() 関数 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
}

/* デフォルト値を指定できる */
.text {
  color: var(--text-color, #333); /* --text-color が未定義の場合 #333 を使用 */
}
```

## Sass 変数との本質的な違い

Sass 変数はコンパイル時のもので、コンパイル後は消えます：

```scss
// Sass 変数
$primary: #409eff;
.btn {
  color: $primary;
}

// コンパイル後
.btn {
  color: #409eff;
}
// 実行時に変数は存在せず、動的に変更できない
```

CSS 変数は実行時に存在します：

```css
/* CSS 変数は実行時に存在し、動的に変更可能 */
:root { --primary: #409eff; }
.btn { color: var(--primary); }

/* JavaScript で変更可能 */
document.documentElement.style.setProperty('--primary', '#67c23a')
/* var(--primary) を使用しているすべての場所がすぐに更新される */
```

これが CSS 変数最大の利点：**実行時の動的変更のサポート**。

## ユースケース 1：テーマ切り替え

以前はテーマ切り替えに複数の CSS セットを事前コンパイルするか、JS でクラスを置換する必要がありました。CSS 変数でずっとシンプルになります：

```css
/* テーマの定義 */
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

/* すべてのコンポーネントは変数のみを使用し、具体的な色は書かない */
body {
  background: var(--bg-color);
  color: var(--text-color);
}
```

```javascript
// テーマを切り替える
document.documentElement.setAttribute("data-theme", "dark");
document.documentElement.setAttribute("data-theme", "light");
```

## ユースケース 2：動的な間隔/サイズ

レスポンシブレイアウトで、画面サイズに応じて間隔が変わる：

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

## ユースケース 3：コンポーネントレベルの変数（ローカルスコープ）

CSS 変数は CSS の継承ルールに従い、コンポーネント内でオーバーライドできます：

```css
/* グローバルデフォルト */
:root {
  --button-bg: #409eff;
  --button-radius: 4px;
}

/* 特定のコンテキスト内でオーバーライド */
.danger-zone {
  --button-bg: #f56c6c;
}

/* .danger-zone 内のすべてのボタンが赤背景になる */
.button {
  background: var(--button-bg);
  border-radius: var(--button-radius);
}
```

このパターンはコンポーネントライブラリのテーマカスタマイズに特に適しています：

```css
/* ユーザーがコンポーネントのデフォルトスタイル変数をオーバーライドできる */
.my-app {
  --el-color-primary: #722ed1; /* Element UI のテーマカラーをカスタマイズ */
}
```

## Sass との組み合わせ

実際のプロジェクトでは両者を組み合わせることができます：Sass はコンパイル時のロジック（ループ、条件、関数）を担当し、CSS 変数は実行時の動的性を担当します。

```scss
// Sass で CSS 変数を一括生成
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

## JavaScript での CSS 変数の読み書き

```javascript
// 読み取り
const value = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// 設定
document.documentElement.style.setProperty("--primary-color", "#67c23a");

// 削除（継承された値に戻す）
document.documentElement.style.removeProperty("--primary-color");

// コンポーネント内でローカルに設定
element.style.setProperty("--button-size", "32px");
```

## ブラウザサポート

2018年初頭時点で、主要ブラウザがサポート：Chrome 49+、Firefox 31+、Safari 9.1+、Edge 15+。IE のみ非対応。

IE のサポートが必要な場合は、`postcss-custom-properties` を使用してコンパイル時に変数を具体的な値に置換できます（動的能力は失われますが互換性が確保されます）。

## まとめ

- CSS 変数の核心的な価値は**実行時の動的性**。Sass 変数にはできないこと
- テーマ切り替え、レスポンシブデザイン、コンポーネントテーマカスタマイズが最適なユースケース
