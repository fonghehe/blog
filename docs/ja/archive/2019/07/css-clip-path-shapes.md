---
title: "CSS clip-path で不規則な形状を実現する"
date: 2019-07-18 11:17:09
tags:
  - CSS
readingTime: 2
description: "従来のCSSのクリッピング方法には限界があります。`overflow: hidden` は矩形のクリッピングしかできず、`border-radius` は角丸にしかなりません。斜めエッジのカード、円形のアバタークロッピング、ウェーブ背景などの不規則な形状が必要な場合、`clip-path` が現在最も強力なソリューショ"
wordCount: 397
---

従来のCSSのクリッピング方法には限界があります。`overflow: hidden` は矩形のクリッピングしかできず、`border-radius` は角丸にしかなりません。斜めエッジのカード、円形のアバタークロッピング、ウェーブ背景などの不規則な形状が必要な場合、`clip-path` が現在最も強力なソリューションです。

## clip-path の基礎

`clip-path` はクリッピング領域を定義し、その領域内のコンテンツのみを表示します。5つの基本形状関数をサポートします：

### inset() — 矩形クリッピング

```css
.clip-inset {
  clip-path: inset(10% 20% 30% 40%);
  /* 各辺を指定の割合でクリップ。marginの構文に類似 */
}

/* 実際の効果：画像の四辺をクリップして中心部分のみ表示 */
.avatar {
  clip-path: inset(5% round 50%);
  /* round の後に角丸の値を指定 */
}
```

### circle() — 円形クリッピング

```css
.avatar-circle {
  width: 100px;
  height: 100px;
  clip-path: circle(50% at 50% 50%);
  /* 中心点(50%, 50%)に半径50%の円 */
}

/* 省略形：at を省略するとデフォルトで中心になる */
.avatar-circle {
  clip-path: circle(50%);
}
```

### ellipse() — 楕円クリッピング

```css
.ellipse-shape {
  clip-path: ellipse(60% 40% at 50% 50%);
  /* 水平半径60%、垂直半径40%、中心点(50%, 50%) */
}
```

### polygon() — 多角形クリッピング（最強）

```css
/* 三角形 */
.triangle {
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  /* 3頂点：上中央、左下、右下 */
}

/* 台形 */
.trapezoid {
  clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
}

/* 六角形 */
.hexagon {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
}

/* 矢印形状 */
.arrow {
  clip-path: polygon(
    0% 20%,
    60% 20%,
    60% 0%,
    100% 50%,
    60% 100%,
    60% 80%,
    0% 80%
  );
}
```

### url() — SVG参照

```css
.clip-svg {
  clip-path: url(#myClipPath);
}
```

```html
<svg width="0" height="0">
  <defs>
    <clipPath id="myClipPath">
      <path d="M50,0 L100,100 L0,100 Z" />
    </clipPath>
  </defs>
</svg>
```

## 実践1：斜めエッジカード

管理画面でよく見られる斜めエッジのタブやカード：

```html
<div class="tab-container">
  <div class="tab active">概要</div>
  <div class="tab">設定</div>
  <div class="tab">ログ</div>
</div>
```

```css
.tab-container {
  display: flex;
  gap: 2px;
}

.tab {
  padding: 12px 40px;
  background: #e0e0e0;
  color: #666;
  cursor: pointer;
  position: relative;

  /* 両側の斜めエッジ効果 */
  clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
  transition:
    background 0.2s,
    color 0.2s;
}

.tab.active {
  background: #1890ff;
  color: #fff;
}

.tab:hover:not(.active) {
  background: #d0d0d0;
}
```

## 実践2：ウェーブ背景

イベントページによく使われるウェーブ形の区切り線。SVG背景や擬似要素+ `border-radius` を使う従来の方法より、`clip-path` の方が柔軟です：

```html
<div class="hero-section">
  <div class="wave-background"></div>
  <div class="content">
    <h1>イベントタイトル</h1>
    <p>イベントの説明文</p>
  </div>
</div>
```

```css
.hero-section {
  position: relative;
  height: 500px;
  overflow: hidden;
}

.wave-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  /* ウェーブ形のクリッピング */
  clip-path: polygon(
    0% 0%,
    100% 0%,
    100% 75%,
    80% 80%,
    60% 85%,
    40% 82%,
    20% 88%,
    0% 83%
  );
}

.content {
  position: relative;
  z-index: 1;
  color: #fff;
  text-align: center;
  padding-top: 150px;
}
```

## まとめ

- `clip-path` は `inset()`、`circle()`、`ellipse()`、`polygon()`、`url()` をサポート
- `polygon()` が最も強力で、ほぼ任意の形状を作れる
- CSSトランジションに対応しており、スムーズなアニメーションも可能
- [Clippy](https://bennettfeely.com/clippy/) などのオンラインツールを使うと clip-path 値の生成が楽になる
