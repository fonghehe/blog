---
title: "CSS グリッドレイアウト入門：Flexbox から Grid 思考への転換"
date: 2018-01-06 14:39:49
tags:
  - CSS
readingTime: 1
description: "CSS Grid は Flexbox では綺麗に解決できないレイアウト問題を解決します。Flexbox は一次元（行または列のどちらか）ですが、Grid は二次元（行と列を同時に）です。"
wordCount: 326
---

CSS Grid は Flexbox では綺麗に解決できないレイアウト問題を解決します。Flexbox は一次元（行または列のどちらか）ですが、Grid は二次元（行と列を同時に）です。

## 基本概念

```css
.container {
  display: grid;
  grid-template-columns: 200px 1fr 1fr; /* 3列: 固定幅 + 2つの可変幅 */
  grid-template-rows: auto;
  gap: 16px; /* row-gap + column-gap */
}
```

`fr` 単位は「残りスペースの割合」を意味します。`flex: 1` に似ています。

## grid-template-areas を使った管理画面レイアウト

```css
.layout {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar main"
    "footer  footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 60px 1fr 40px;
  min-height: 100vh;
}

.header {
  grid-area: header;
}
.sidebar {
  grid-area: sidebar;
}
.main {
  grid-area: main;
}
.footer {
  grid-area: footer;
}
```

`grid-template-areas` のアスキーアートによる視覚的な表現でレイアウトが一目瞭然になります。

## auto-fill + minmax でレスポンシブカード

```css
.card-grid {
  display: grid;
  /* auto-fill: 収まる限り多くの列を生成
     minmax(260px, 1fr): 各列は最低260px、必要に応じて拡大 */
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
```

**メディアクエリなし**でレスポンシブ対応できます。ブラウザのサイズを変更すると列数が自動的に増減します。

## アイテムのスパン

```css
/* 2列2行にまたがるアイテム */
.featured {
  grid-column: span 2;
  grid-row: span 2;
}

/* 正確な配置 */
.sidebar {
  grid-column: 1 / 2; /* 列ライン1から2まで */
  grid-row: 1 / 3; /* 行ライン1から3まで */
}
```

## 配置（アライメント）

```css
.container {
  justify-items: center; /* 全アイテムの水平方向の配置 */
  align-items: center; /* 全アイテムの垂直方向の配置 */
}

/* 個別アイテムのオーバーライド */
.item {
  justify-self: end;
  align-self: start;
}
```

## Grid vs Flexbox の使い分け

- **Grid**：ページ全体のレイアウト、二次元レイアウト（行と列）
- **Flexbox**：一次元レイアウト（ナビゲーションバー、ボタングループ）

実践では組み合わせて使うことが多いです。Grid でページの骨格を作り、各セル内のアイテムには Flexbox を使います。
