---
title: "ブラウザのレンダリングパイプライン：解析から描画まで"
date: 2019-11-07 09:32:47
tags:
  - パフォーマンス最適化
readingTime: 7
description: "ブラウザのレンダリングパイプラインを理解することは、フロントエンドパフォーマンス最適化の基礎です。CSS プロパティを変更すると、ブラウザはピクセルを画面に表示するまでに一連の複雑な処理ステップを経由します。各ステップで何が行われているかを理解することで、より賢明なパフォーマンスに関する判断ができるようになります。"
wordCount: 1541
---

ブラウザのレンダリングパイプラインを理解することは、フロントエンドパフォーマンス最適化の基礎です。CSS プロパティを変更すると、ブラウザはピクセルを画面に表示するまでに一連の複雑な処理ステップを経由します。各ステップで何が行われているかを理解することで、より賢明なパフォーマンス判断ができるようになります。

## レンダリングパイプラインの概要

ブラウザが HTML を画面上のピクセルに変換するプロセスは、ピクセルパイプライン（Pixel Pipeline）と呼ばれ、主に以下のステップで構成されています：

```
JavaScript → Style → Layout → Paint → Composite
             計算スタイル   レイアウト  描画    合成
```

1. **JavaScript**：JS を実行し、DOM や CSSOM を変更
2. **Style（スタイル計算）**：各要素の最終的なスタイルを計算
3. **Layout（レイアウト）**：要素の幾何情報（位置とサイズ）を計算
4. **Paint（描画）**：要素をレイヤーに描画（ボーダー、背景、テキストなど）
5. **Composite（合成）**：複数のレイヤーを最終的なページに合成

## 1. 解析フェーズ

### HTML 解析と DOM ツリー

ブラウザはまず HTML を DOM（Document Object Model）ツリーに解析します：

```html
<html>
  <head>
    <title>ページタイトル</title>
  </head>
  <body>
    <div class="container">
      <h1>見出し</h1>
      <p>段落</p>
    </div>
  </body>
</html>
```

解析プロセス：

```
HTML テキスト
    │
    ▼
HTML パーサー
    │
    ▼
DOM ツリー
    Document
      └── html
            ├── head
            │     └── title
            │           └── "ページタイトル"
            └── body
                  └── div.container
                        ├── h1 → "見出し"
                        └── p → "段落"
```

### CSS 解析と CSSOM

CSS ファイルは CSSOM（CSS Object Model）ツリーに解析されます：

```css
.container {
  width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 24px;
  color: #333;
}
```

CSSOM もツリー構造であり、各ノードにはスタイルルールが含まれています。CSS の解析は**レンダリングブロッキング**です。ブラウザがレイアウトを行うには完全なスタイル情報が必要だからです。

### クリティカルレンダリングパス

```
HTML ──→ DOM ──────┐
                   ├──→ Render Tree ──→ Layout ──→ Paint ──→ Composite
CSS  ──→ CSSOM ────┘
```

DOM と CSSOM がマージされてレンダーツリー（Render Tree）が形成され、可視要素のみが含まれます：

- `<head>` とその子要素はレンダーツリーに含まれない
- `display: none` の要素はレンダーツリーに含まれない
- `visibility: hidden` の要素はレンダーツリーに含まれる（スペースを占有する）

## 2. スタイル計算

スタイル計算フェーズでは、ブラウザがすべての CSS ルールを DOM ノードに適用し、各要素の最終的なスタイルを計算します：

```css
/* 複数のルールが同じ要素にマッチする可能性がある */
p { color: black; }
.text { color: blue; }
#main p { color: red; }
```

ブラウザは CSS の優先度（Specificity）を計算し、最終的なスタイルを決定します。このプロセスの結果は `ComputedStyle` オブジェクトであり、`window.getComputedStyle()` で確認できます：

```js
const el = document.querySelector('.title');
const styles = window.getComputedStyle(el);
console.log(styles.color);       // "rgb(51, 51, 51)"
console.log(styles.fontSize);    // "24px"
console.log(styles.display);     // "block"
```

## 3. レイアウト

レイアウトフェーズでは、各要素の幾何情報（位置、サイズ）を計算します。このプロセスは Reflow（リフロー）とも呼ばれます：

```js
// Layout をトリガーする操作
element.style.width = '200px';  // サイズを変更
element.style.left = '10px';    // 位置を変更
window.innerWidth;              // レイアウト情報の読み取りも強制 Layout をトリガーする
element.offsetWidth;            // 同上
element.getBoundingClientRect();
```

### レイアウトの影響範囲

1つの要素のレイアウトを変更すると、他の要素にも影響を与える可能性があります：

```
// 要素の幅を変更
<div class="parent" style="width: 400px">
  <div class="child" style="width: 50%">200px</div>
  <div class="sibling">残りのスペース</div>
</div>

// 親要素の幅が 600px に変わった場合
// child は 200px から 300px に
// sibling も再レイアウトが必要
```

## 4. ペイント

描画フェーズでは、要素の視覚効果をレイヤーに描画します。描画はレイヤー（Layer）単位で行われます：

```js
// 以下の CSS プロパティの変更は Paint のみをトリガーし、Layout はトリガーしない
element.style.color = 'red';          // 描画のみ
element.style.backgroundColor = '#f00'; // 描画のみ
element.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; // 描画のみ
element.style.borderRadius = '8px';    // 描画のみ
element.style.visibility = 'hidden';   // 描画のみ
```

### 描画の種類

- **描画レコード（Paint Records）**：描画操作のリストを記録
- **ラスタライゼーション（Rasterization）**：描画レコードをピクセルビットマップに変換
- ラスタライゼーションは通常 GPU で実行され、モダンブラウザはコンポジッタースレッドを使用して処理

## 5. コンポジット

モダンブラウザはページを複数のレイヤー（Compositing Layers）に分割し、個別に描画してから合成します：

```
┌────────────────────────────────┐
│  Layer 3: モーダル              │
├────────────────────────────────┤
│  Layer 2: 固定ナビゲーションバー │
├────────────────────────────────┤
│  Layer 1: ページ本文            │
├────────────────────────────────┤
│  Layer 0: 背景                  │
└────────────────────────────────┘
```

### 新しいレイヤーが作成される条件

```css
/* 以下のプロパティは新しい合成レイヤーを作成する */
.transform-layer {
  /* 1. 3D トランスフォーム */
  transform: translateZ(0);
  /* または will-change */
  will-change: transform;
}

.video-layer {
  /* 2. <video>、<canvas>、<iframe> などの要素 */
}

.fixed-layer {
  /* 3. position: fixed の場合（特定の条件下） */
  position: fixed;
}

.composited-layer {
  /* 4. 合成レイヤーの子孫を持ち、z-index がある */
  position: relative;
  z-index: 1;
}

.animated-layer {
  /* 5. transform または opacity の CSS アニメーション実行中 */
  animation: slide 1s ease;
}

@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

## CSS プロパティ別の影響範囲

どのプロパティの変更がパイプラインのどのステップをトリガーするかを理解することが、パフォーマンス最適化の鍵です：

| 変更するプロパティ | トリガーされるフェーズ | パフォーマンスへの影響 |
|-------------------|----------------------|----------------------|
| width, height, margin, padding | Layout → Paint → Composite | 最も遅い（全パイプライン） |
| color, background, box-shadow | Paint → Composite | やや速い（Layout をスキップ） |
| transform, opacity | Composite | 最も速い（合成のみ） |

### transform で top/left を置き換える

```css
/* 悪い例：毎回レイアウトをトリガー */
.moving-bad {
  position: absolute;
  transition: left 0.3s;
}
.moving-bad:hover {
  left: 100px;
}

/* 良い例：合成のみをトリガー */
.moving-good {
  transition: transform 0.3s;
}
.moving-good:hover {
  transform: translateX(100px);
}
```

### opacity で visibility のアニメーションを置き換える

```css
/* opacity は合成のみをトリガー */
.fade-in {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## 強制同期レイアウト

レイアウトプロパティの読み書きを交互に行うと、ブラウザが強制的に同期レイアウトを実行し、パフォーマンスに深刻な影響を与えます：

```js
// 悪い例：読み書きを交互に行い、書き込みのたびに強制レイアウト
function resizeAll() {
  const boxes = document.querySelectorAll('.box');
  boxes.forEach(box => {
    const width = box.offsetWidth;         // 読み取り（強制レイアウト）
    box.style.width = (width + 10) + 'px'; // 書き込み（レイアウトを無効化）
  });
}

// 良い例：先に読み取り、後に書き込み
function resizeAllOptimized() {
  const boxes = document.querySelectorAll('.box');
  // 先に読み取り
  const widths = Array.from(boxes).map(box => box.offsetWidth);
  // 後に書き込み
  boxes.forEach((box, i) => {
    box.style.width = (widths[i] + 10) + 'px';
  });
}
```

## レイアウトスラッシング（Layout Thrashing）

レイアウトスラッシングとは、同一フレーム内でレイアウトを繰り返しトリガーするパフォーマンス問題です：

```js
// 悪い例：ループ内でレイアウトプロパティを読み書き
function layoutThrashing() {
  const items = document.querySelectorAll('.item');
  items.forEach(item => {
    // offsetHeight を読み取るたびに同期レイアウトがトリガーされる
    const height = item.offsetHeight;
    item.style.height = (height * 1.1) + 'px';
  });
}

// 良い例：requestAnimationFrame で一括処理
function optimized() {
  const items = document.querySelectorAll('.item');
  const heights = [];

  items.forEach(item => heights.push(item.offsetHeight));

  requestAnimationFrame(() => {
    items.forEach((item, i) => {
      item.style.height = (heights[i] * 1.1) + 'px';
    });
  });
}
```

## Performance APIで計測する

```js
// レンダリングパフォーマンスを計測
function measureRender(label, fn) {
  performance.mark(`${label}-start`);
  fn();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measures = performance.getEntriesByName(label);
      console.log(`${label}: ${measures[0].duration.toFixed(2)}ms`);
    });
  });
}

measureRender('リストレンダリング', () => {
  renderList(1000);
});
```

## まとめ

- レンダリングパイプライン：JavaScript → Style → Layout → Paint → Composite
- `width`、`height` などのジオメトリプロパティの変更は全パイプラインをトリガー（最も遅い）
- `color`、`background` などのプロパティの変更は Paint のみをトリガー（やや速い）
- `transform`、`opacity` の変更は Composite のみをトリガー（最も速い）
- 強制同期レイアウト（読み書きの交互実行）はパフォーマンスに深刻な影響を与える
- `will-change` を使用してブラウザに事前に合成レイヤーの作成を促す
- `requestAnimationFrame` を使用して DOM 更新を一括処理する
- アニメーションには `top/left` の代わりに `transform` を使用する
