---
title: "CSS Grid 上級編 — grid-template-areas から実践レイアウトまで"
date: 2019-07-08 11:22:58
tags:
  - CSS
readingTime: 3
description: "CSS Grid は主要ブラウザでサポートされてからしばらく経ちます。`grid-template-columns` と `grid-template-rows` の基本的な使い方は多くの人が知っていますが、`grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax("
---

CSS Grid は主要ブラウザでサポートされてからしばらく経ちます。`grid-template-columns` と `grid-template-rows` の基本的な使い方は多くの人が知っていますが、`grid-template-areas`、`auto-fill` vs `auto-fit`、`minmax()` などの上級機能こそ Grid の真の力を発揮するものです。この記事では実際のレイアウト例を通じてこれらの機能を解説します。

## grid-template-areas：テキストでレイアウトを描く

従来の行・列番号を指定する方法は可読性が低いです。`grid-template-areas` を使うとテキストでレイアウト構造を視覚的に記述できます：

```css
.layout {
  display: grid;
  min-height: 100vh;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 240px 1fr 200px;
  grid-template-rows: 60px 1fr 50px;
  grid-gap: 0;
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
.aside {
  grid-area: aside;
}
.footer {
  grid-area: footer;
}
```

コードの可読性が一目瞭然——レイアウトの見た目がそのままコードになっています。

### レスポンシブレイアウトとの組み合わせ

メディアクエリと組み合わせることで、レイアウト構造を簡単に変更できます：

```css
@media (max-width: 768px) {
  .layout {
    grid-template-areas:
      "header"
      "content"
      "footer";
    grid-template-columns: 1fr;
    grid-template-rows: 50px 1fr 50px;
  }

  .sidebar {
    display: none;
  }
}
```

### ドットで空のエリアを表現

コンテンツが不要なエリアには `.` を使います：

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  chart"
    "table  table  chart"
    ".      .      chart";
  grid-template-columns: 1fr 1fr 300px;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
}
```

## auto-fill vs auto-fit

この2つの値は似ていますが動作が全く異なります。どちらも `grid-template-columns` で使用し、コンテナサイズが不確定なときに列数を自動決定します。

### auto-fill

```css
.grid-auto-fill {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fill` は子要素が足りなくても、できるだけ多くの列トラックを作成します。コンテナ幅800px、最小列幅200pxの場合、4つの列トラックが作られます。子要素が2つしかなくても、3・4列目の空トラックは残ります（見えなくても）。

### auto-fit

```css
.grid-auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

`auto-fit` は子要素が行を埋めない場合、空の列トラックを幅0に折り畳み、既存の子要素が残りのスペースを伸びて埋めます。

### 違いの比較

コンテナ幅800px、最小列幅200px、子要素2つの場合：

```
auto-fill（4列、空列2つ残る）:
+--------+--------+--------+--------+
|  item1 |  item2 |   空   |   空   |
+--------+--------+--------+--------+

auto-fit（2列、空列が折り畳まれ子要素が伸びる）:
+--------------------+--------------------+
|       item1        |       item2        |
+--------------------+--------------------+
```

実践的なガイドライン：

- **商品リストやカードレイアウト**には `auto-fit` が多くの場合期待通りの動作をします
- **固定セル位置が必要なグリッドギャラリー**などには `auto-fill` を使用します

## minmax() の活用

`minmax()` はサイズ範囲を定義し、`auto-fill`/`auto-fit` と組み合わせると非常に効果的です：

```css
/* アダプティブカード：最小280px、最大は均等分割 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

/* テーブル：第1列固定幅、残りは適応 */
.data-table {
  display: grid;
  grid-template-columns: 60px minmax(200px, 2fr) minmax(100px, 1fr) minmax(
      80px,
      0.5fr
    );
}
```

## まとめ

- `grid-template-areas` でレイアウトの可読性が大幅に向上する
- カードには `auto-fit`、固定グリッドには `auto-fill` が適している
- `minmax()` はレスポンシブレイアウトの基本
- Grid とメディアクエリを組み合わせると、余分なラッパーなしにきれいなレスポンシブデザインが実現できる
