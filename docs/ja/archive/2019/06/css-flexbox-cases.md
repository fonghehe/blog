---
title: "CSS Flexboxによる複雑なレイアウト事例"
date: 2019-06-18 11:05:37
tags:
  - CSS
readingTime: 1
description: "CSS Flexboxの複雑なレイアウト事例に関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。"
---

CSS Flexboxの複雑なレイアウト事例に関する記事はネット上に多くありますが、実践的な経験を持つものは少ないです。本記事では実際のプロジェクトをベースにベストプラクティスを探ります。

## Flexboxの基礎

```css
.container {
  display: flex;
  flex-direction: row; /* 主軸の方向: row（デフォルト）| column */
  flex-wrap: wrap; /* 折り返し: nowrap（デフォルト）| wrap */
  justify-content: flex-start; /* 主軸の揃え */
  align-items: stretch; /* 交差軸の揃え */
  gap: 16px; /* アイテム間のスペース */
}
```

## よくあるレイアウトパターン

### 等幅カラム

```css
.columns {
  display: flex;
  gap: 16px;
}
.columns > * {
  flex: 1; /* flex-grow: 1, flex-shrink: 1, flex-basis: 0% */
}
```

### スティッキーフッター

```css
/* コンテンツの長さに関わらずフッターが常に下部に */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1; /* 使用可能なスペースを埋めるように伸長 */
}
footer {
  /* 自然な高さ */
}
```

### 聖杯レイアウト（ヘッダー + 左サイドバー + メイン + 右サイドバー + フッター）

```css
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.layout-body {
  display: flex;
  flex: 1;
}
.layout-sidebar-left {
  width: 200px;
  flex-shrink: 0;
}
.layout-main {
  flex: 1;
  min-width: 0;
} /* min-width:0でオーバーフロー防止 */
.layout-sidebar-right {
  width: 160px;
  flex-shrink: 0;
}
```

### 等高カードのカードグリッド

```css
.card-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 1 1 280px; /* 最小280px、等しく伸長 */
  display: flex;
  flex-direction: column;
}
.card-body {
  flex: 1; /* カードの残りの高さを埋めるように伸長 */
}
```

## センタリング——最も一般的なユースケース

```css
/* 水平・垂直両方の中央揃え */
.centered {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* テキスト + アイコンの垂直センタリング */
.inline-center {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```

Flexboxは1次元のレイアウト（単一の行または列）に最適です。2次元のレイアウトにはCSS Gridを検討してください。
