---
title: "CSS Grid template-areasレイアウト実践"
date: 2019-12-05 10:47:52
tags:
  - CSS
readingTime: 5
description: "CSS Grid レイアウト仕様が登場して数年が経ち、ブラウザのサポートもかなり充実しています（IE11 はプレフィックス付きで一部対応）。しかし実際のプロジェクトでは、多くの開発者が依然としてすべてのレイアウト問題を Flexbox で解決することに慣れています。最近管理画面のページレイアウトをリファクタリングする際に Grid の template-areas を全面的に採用したところ、効果は予想以上に良好でした。この記事では実践経験を共有します。"
wordCount: 903
---

CSS Grid レイアウト仕様が出てから数年が経ち、ブラウザのサポートもかなり充実しています（IE11 はプレフィックス付きで一部対応）。しかし実際のプロジェクトでは、多くの開発者が今でも Flexbox ですべてのレイアウト問題を解決することに慣れています。最近、管理画面のページレイアウトをリファクタリングする際に Grid の `template-areas` を全面的に採用したところ、効果は予想以上に良好でした。この記事では実戦経験を共有します。

## 基本概念：grid-template-areas

`grid-template-areas` を使用すると、「描く」ようにレイアウトを定義できます。各領域には名前が付き、直感的で保守が容易です：

```css
/* 最も古典的な管理画面レイアウト */
.app-layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content content"
    "sidebar content content";
  grid-template-columns: 240px 1fr 1fr;
  grid-template-rows: 64px 1fr auto;
  min-height: 100vh;
  gap: 0;
}

.header {
  grid-area: header;
  background: #001529;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.sidebar {
  grid-area: sidebar;
  background: #001529;
  color: #fff;
  overflow-y: auto;
}

.content {
  grid-area: content;
  padding: 24px;
  overflow-y: auto;
  background: #f0f2f5;
}
```

対応する HTML 構造は非常にシンプルです：

```html
<div class="app-layout">
  <header class="header">Logo</header>
  <nav class="sidebar">Navigation</nav>
  <main class="content">Page Content</main>
</div>
```

## クラシックなページレイアウト事例

管理画面で最も一般的な Dashboard ページは、通常、上部に統計カード、左側にチャート、右側にリストがあります。`template-areas` を使用すると非常に直感的に表現できます：

```css
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  stats"
    "chart1 chart2 list"
    "chart1 chart2 list";
  grid-template-columns: 1fr 1fr 320px;
  grid-template-rows: auto 1fr 1fr;
  gap: 16px;
  padding: 16px;
}

.stats-row {
  grid-area: stats;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.chart-primary {
  grid-area: chart1;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.chart-secondary {
  grid-area: chart2;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.side-list {
  grid-area: list;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  overflow-y: auto;
}
```

```html
<div class="dashboard">
  <div class="stats-row">
    <div class="stat-card">DAU: 12,345</div>
    <div class="stat-card">注文件数: 678</div>
    <div class="stat-card">売上高: ¥89,012</div>
    <div class="stat-card">コンバージョン率: 3.4%</div>
  </div>
  <div class="chart-primary">
    <h3>アクセス傾向</h3>
    <div id="trend-chart"></div>
  </div>
  <div class="chart-secondary">
    <h3>チャネル分布</h3>
    <div id="channel-chart"></div>
  </div>
  <div class="side-list">
    <h3>最近の注文</h3>
    <ul id="order-list"></ul>
  </div>
</div>
```

## レスポンシブ再配置

`template-areas` の最大の利点の1つは、レスポンシブレイアウトが非常に直感的であることです。領域の「絵」を描き直すだけでよく、HTML 構造を変更する必要はありません：

```css
/* デスクトップ：3列レイアウト */
.dashboard {
  display: grid;
  grid-template-areas:
    "stats  stats  stats"
    "chart1 chart2 list"
    "chart1 chart2 list";
  grid-template-columns: 1fr 1fr 320px;
  gap: 16px;
}

/* タブレット：2列レイアウト */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-areas:
      "stats  stats"
      "chart1 chart1"
      "chart2 list";
    grid-template-columns: 1fr 1fr;
  }
}

/* モバイル：1列スタック */
@media (max-width: 768px) {
  .dashboard {
    grid-template-areas:
      "stats"
      "chart1"
      "chart2"
      "list";
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }

  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

Flexbox のレスポンシブ方式と比較して、Grid の `template-areas` はブレークポイントの切り替え時に HTML の順序を調整したり `order` プロパティを使用する必要がまったくなく、視覚的な意味が一目でわかります。

## 空セルで空白領域を処理する

レイアウト内の特定の領域を空にしたい場合があります。その場合は `.` を使用します：

```css
/* サイドバーが一部の高さのみを占めるレイアウト */
.complex-layout {
  display: grid;
  grid-template-areas:
    "header  header  header"
    "sidebar content aside"
    "sidebar content aside"
    "footer  footer  footer";
  grid-template-columns: 200px 1fr 280px;
  grid-template-rows: 60px 1fr 1fr 48px;
}

/* aside が不要な場合は . で埋める */
.simple-layout {
  display: grid;
  grid-template-areas:
    "header  header"
    "sidebar content"
    "sidebar content"
    "footer  footer";
  grid-template-columns: 200px 1fr;
  grid-template-rows: 60px 1fr auto 48px;
}
```

## GridとFlexboxの組み合わせ

Grid はマクロなページレイアウトを担当し、Flexbox はコンポーネント内部の配置を担当します。両者を組み合わせるのがベストプラクティスです：

```css
/* Grid が全体レイアウトを担当 */
.page-layout {
  display: grid;
  grid-template-areas:
    "header header"
    "nav    main"
    "footer footer";
  grid-template-columns: 240px 1fr;
  grid-template-rows: 64px 1fr 48px;
  min-height: 100vh;
}

/* Flexbox が header 内部の配置を担当 */
.header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

/* Flexbox がナビゲーション項目の配置を担当 */
.nav {
  grid-area: nav;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
}

.main {
  grid-area: main;
  padding: 24px;
  overflow-y: auto;
}
```

## 実際のプロジェクトでの注意事項

実際のプロジェクトで `template-areas` を使用する際のいくつかのポイント：

```css
/* 1. 領域名は矩形を形成する必要があり、L 字型や T 字型は不可 */
/* 誤った例：以下の記述は機能しません */
/* grid-template-areas:
    "a a b"
    "a a c"
    "d d c";  -- これは合法ですが、"a a b" / "a a c" で a が矩形を形成しています */

/* 2. minmax を使用して内容のはみ出しを防止 */
.dashboard {
  grid-template-columns: minmax(200px, 240px) 1fr minmax(280px, 320px);
}

/* 3. auto-fit / auto-fill を使用して動的な列数を処理 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

/* 4. CSS 変数と組み合わせてテーマ化を実現 */
:root {
  --sidebar-width: 240px;
  --header-height: 64px;
}

.app-layout {
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: var(--header-height) 1fr;
}
```

## まとめ

- `grid-template-areas` は名前付き領域でレイアウトを定義し、直感的で保守が容易、図を描くようにページ構造を整理できる
- レスポンシブレイアウトはブレークポイントで `template-areas` を再定義するだけでよく、HTML 構造を変更する必要がない
- Grid がマクロなレイアウトを担当し、Flexbox がコンポーネント内部の配置を担当、両者の組み合わせがベストプラクティス
- 領域名は矩形を形成する必要があり、`.` で空白領域を表す
- `minmax`、`auto-fit`、CSS 変数と組み合わせることで、柔軟で保守可能なレイアウトシステムを構築できる
- ブラウザの互換性は非常に良好で、IE11 は `-ms-` プレフィックス付きで一部対応、モダンブラウザは完全対応
