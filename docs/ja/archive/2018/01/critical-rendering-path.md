---
title: "フロントエンドパフォーマンス：クリティカルレンダリングパスを理解する"
date: 2018-01-11 17:34:30
tags:
  - パフォーマンス最適化
readingTime: 4
description: "パフォーマンス最適化を行う前に、ブラウザがHTMLを受信してからユーザーがページを見るまでに何が起きているかを理解する必要があります。これらのステップをまとめて**クリティカルレンダリングパス**と呼びます。"
---

パフォーマンス最適化を行う前に、ブラウザがHTMLを受信してからユーザーがページを見るまでに何が起きているかを理解する必要があります。これらのステップをまとめて**クリティカルレンダリングパス**と呼びます。

## ブラウザレンダリングの5つのステップ

1. **HTML を解析 → DOM ツリーを構築**
2. **CSS を解析 → CSSOM ツリーを構築**
3. **DOM と CSSOM を結合 → レンダーツリーを生成**
4. **レイアウト（リフロー）**：各ノードの位置とサイズを計算
5. **ペイント**：レンダーツリーを画面上のピクセルに変換

ステップ 1 と 2 は並行して行われますが、重要なブロッキングルールがあります：**CSS はレンダリングをブロックし、JS は解析をブロックします**。

## CSS がレンダリングをブロックする

ブラウザはレンダリングを開始する前に CSSOM の構築が完了するのを待つ必要があります。理由はシンプルです：CSS の前にレンダリングすると、スタイルなしコンテンツのフラッシュ（FOUC）が発生します。

```html
<!-- この CSS ファイルのダウンロードと解析がページレンダリングをブロックする -->
<link rel="stylesheet" href="/styles/main.css" />
```

最適化の方向性：

- CSS ファイルサイズを削減、未使用スタイルを削除（PurgeCSS）
- クリティカル CSS をインライン化（ファーストビューのスタイル）
- 非クリティカル CSS を非同期で読み込む

```html
<!-- クリティカル CSS のインライン化 -->
<style>
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .header {
    height: 60px;
    background: #fff;
  }
</style>

<!-- 非クリティカル CSS を非同期で読み込む -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
```

## JS が HTML 解析をブロックする

HTML パーサーが `<script>` タグに遭遇すると、JS のダウンロードと実行が完了するまで **DOM 構築を一時停止**します。

```html
<!-- 悪い例：DOM 解析をブロック、最初の描画が遅くなる -->
<head>
  <script src="/js/app.js"></script>
</head>

<!-- 良い例：body の末尾に配置、DOM 解析後に実行 -->
<body>
  <!-- ページコンテンツ -->
  <script src="/js/app.js"></script>
</body>
```

さらに良い方法：`defer` または `async` を使用する：

```html
<!-- defer：非同期ダウンロード、DOM 準備完了後に順番通り実行 -->
<script defer src="/js/vendor.js"></script>
<script defer src="/js/app.js"></script>

<!-- async：非同期ダウンロード、準備完了後すぐに実行（順序保証なし） -->
<script async src="/js/analytics.js"></script>
```

`defer` はほとんどのアプリケーションスクリプトに適しています。`async` は独立したサードパーティスクリプト（分析、広告）に適しています。

## リフローとリペイント

初回レンダリング後、DOM やスタイルを変更すると再レンダリングが発生します：

- **リフロー（レイアウト）**：幾何学的プロパティが変化し、位置とサイズを再計算。最もコストが高い。
- **リペイント**：視覚的な外観が変化（色、背景）、レイアウトには影響なし。中程度のコスト。
- **コンポジット**：`transform` と `opacity` のみが影響、独立したコンポジットレイヤーで処理。最もコストが低い。

```javascript
// リフローを引き起こすプロパティ（読み取りも強制的な同期レイアウトを引き起こす）
element.offsetWidth;
element.offsetHeight;
element.scrollTop;
element.clientWidth;
window.getComputedStyle(element);

// ループ内での読み書き混在を避ける（強制同期レイアウト）
// 悪い例：各繰り返しでレイアウトの再計算を強制
for (let i = 0; i < items.length; i++) {
  items[i].style.width = container.offsetWidth + "px"; // 読み取り + 書き込み
}

// 良い例：一度読み取り、まとめて書き込み
const containerWidth = container.offsetWidth;
for (let i = 0; i < items.length; i++) {
  items[i].style.width = containerWidth + "px";
}
```

## コンポジットレイヤーで高性能アニメーション

アニメーション要素を独立したコンポジットレイヤーに昇格させると、リフローとリペイントが発生しません：

```css
.animated-element {
  will-change: transform; /* ブラウザにコンポジットレイヤー作成を示唆 */
}

/* 高性能アニメーション：transform と opacity のみ使用 */
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

`will-change` の乱用は禁物です。各コンポジットレイヤーは GPU メモリを消費します。

## Chrome DevTools でボトルネックを見つける

1. DevTools を開き、**Performance** パネルに移動
2. 録画を開始、操作を実行、録画を停止
3. フレームグラフを確認し、特に注目：
   - 紫色の **Layout** ブロック（リフロー）
   - 緑色の **Paint** ブロック（リペイント）
   - 「ロングタスク」（50ms 以上のタスクブロック）
