---
title: "CSS Gridレイアウト応用：名前付きグリッドラインとテンプレートエリア"
date: 2019-02-13 17:08:59
tags:
  - CSS
readingTime: 1
description: "仕事でCSS Gridをしばらく使っていると、ほとんどの開発者が基本的な`grid-template-columns: repeat(3, 1fr)`で止まっていることに気づく。名前付きグリッドラインとテンプレートエリアこそ、Gridを複雑なレイアウトの切り札にする機能だ。"
---

仕事でCSS Gridをしばらく使っていると、ほとんどの開発者が基本的な`grid-template-columns: repeat(3, 1fr)`で止まっていることに気づく。名前付きグリッドラインとテンプレートエリアこそ、Gridを複雑なレイアウトの切り札にする機能だ。

## 名前付きグリッドライン

グリッドラインに名前を付けると、セマンティックな方法で要素を配置できる：

```css
.layout {
  display: grid;
  grid-template-columns:
    [sidebar-start] 240px
    [sidebar-end content-start] 1fr
    [content-end];
  grid-template-rows:
    [header-start] 60px
    [header-end main-start] auto
    [main-end footer-start] 48px
    [footer-end];
}

.header {
  grid-column: sidebar-start / content-end;
  grid-row: header-start / header-end;
}
.sidebar {
  grid-column: sidebar-start / sidebar-end;
  grid-row: main-start / main-end;
}
.content {
  grid-column: content-start / content-end;
  grid-row: main-start / main-end;
}
.footer {
  grid-column: sidebar-start / content-end;
  grid-row: footer-start / footer-end;
}
```

## grid-template-areas

テンプレートエリアはGridレイアウトの中で最も可読性が高い方法だ——ASCIIアートがそのままレイアウト図になる：

```css
.layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 1fr;
  grid-template-rows: 60px auto 48px;
  min-height: 100vh;
}

.header {
  grid-area: header;
}
.sidebar {
  grid-area: sidebar;
}
.content {
  grid-area: content;
}
.footer {
  grid-area: footer;
}
```

### レスポンシブレイアウト

```css
@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "sidebar"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: auto;
  }
}
```

## 自動フィルと自動レイアウト

```css
/* 自動列数、最小200px */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

/* auto-fillとauto-fitの違い */
/* auto-fill：できるだけ多くの列を埋める、小画面では空列が生じる可能性 */
/* auto-fit：既存要素を引き伸ばしてコンテナを満たす */
```

## subgrid（CSS Grid Level 2）

subgridは2019年に議論が盛んだった提案で、子グリッドが親グリッドのトラック定義を共有できるようにする：

```css
/* カードグループ内のコンテンツ整列に非常に便利 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.card {
  display: grid;
  /* grid-row: span 3; とsubgridを組み合わせてコンテンツ整列を実現 */
```
