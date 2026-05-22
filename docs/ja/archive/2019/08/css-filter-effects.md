---
title: "CSS filterエフェクト実践"
date: 2019-08-28 10:01:02
tags:
  - CSS
readingTime: 4
description: "CSS の filter プロパティを使用すると、画像素材を変更することなく、要素にぼかし、グレースケール、コントラスト調整、シャドウなどのさまざまな視覚効果を適用できます。このプロパティは画像処理、UI アニメーション、ダークモード対応などのシーンで非常に便利です。この記事では各 filter 関数の使い方を詳しく解説し、実際のケースを通して組み合わせ方を紹介します。"
wordCount: 793
---

CSS `filter` プロパティを使用すると、画像素材を変更することなく、要素にさまざまな視覚効果（ぼかし、グレースケール、コントラスト調整、シャドウなど）を適用できます。このプロパティは画像処理、UI アニメーション、ダークモード対応などのシーンで非常に便利です。この記事では各 filter 関数の使い方を詳しく解説し、実際のケースを通して組み合わせ方を紹介します。

## filter 基本構文

```css
.element {
  filter: <function>(<value>);
  /* 複数のフィルターを重ねることができます */
  filter: blur(5px) brightness(1.2) contrast(0.8);
}
```

## フィルター関数リファレンス

### blur — ガウシアンぼかし

```css
/* 値は長さ単位で、値が大きいほどぼやけます */
.card-bg {
  filter: blur(20px);
}

/* 一般的なすりガラス効果 */
.frosted-glass {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);  /* 注意：backdrop-filter は別のプロパティです */
  -webkit-backdrop-filter: blur(10px);
}
```

### brightness — 明るさ

```css
/* 0 = 完全に黒, 1 = 元の明るさ, >1 = より明るい */
.hover-bright:hover {
  filter: brightness(1.2);
}

/* 暗くする */
.dim {
  filter: brightness(0.6);
}
```

### contrast — コントラスト

```css
/* 1 = 元の状態, <1 コントラスト低下, >1 コントラスト増加 */
.high-contrast {
  filter: contrast(1.5);
}

.low-contrast {
  filter: contrast(0.5);
}
```

### grayscale — グレースケール

```css
/* 0 = カラー, 1 = 完全グレースケール */
.grayscale {
  filter: grayscale(1);
}

/* 哀悼日にサイト全体をグレースケールに */
body.mourning {
  filter: grayscale(1);
}

/* hover 時にカラーに戻す */
.gallery-item {
  filter: grayscale(0.8);
  transition: filter 0.3s;
}
.gallery-item:hover {
  filter: grayscale(0);
}
```

### sepia — セピア調

```css
/* 0 = 元の状態, 1 = 完全セピア */
.vintage-photo {
  filter: sepia(0.8);
}
```

### saturate — 彩度

```css
/* 0 = 無彩度（グレースケール）, 1 = 元の状態, >1 = 高彩度 */
.vibrant {
  filter: saturate(1.5);
}

.muted {
  filter: saturate(0.5);
}
```

### hue-rotate — 色相回転

```css
/* 値は角度で、色相を回転します */
.color-shift {
  filter: hue-rotate(90deg);
}

/* 動的な色彩変化アニメーション */
@keyframes rainbow {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

.rainbow-effect {
  animation: rainbow 3s linear infinite;
}
```

### invert — 反転

```css
/* 0 = 元の状態, 1 = 完全反転 */
.inverted {
  filter: invert(1);
}

/* 反転はダークモードの簡易実装によく使われます */
.quick-dark-mode {
  filter: invert(1) hue-rotate(180deg);
}
/* hue-rotate(180deg) で反転後の色を戻し、写真が不自然に見えるのを防ぎます */
```

### opacity — 不透明度

```css
/* CSS opacity と似ていますが、他の filter と組み合わせられます */
.transparent {
  filter: opacity(0.5);
}

/* コントラストとの組み合わせ */
.muted-card {
  filter: opacity(0.8) contrast(0.9);
}
```

### drop-shadow — ドロップシャドウ

```css
/* box-shadow に似ていますが、不規則な形状にも適用できます */
.icon-shadow {
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3));
}

/* drop-shadow は透明 PNG 画像に有効です */
.png-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* box-shadow は要素の矩形境界にのみ作用します */
/* drop-shadow は要素の実際の内容（アルファチャンネル）に基づいて影を投影します */
```

## 実践事例

### 実例1：画像ローディングトランジション効果

```html
<div class="image-wrapper">
  <img src="photo.jpg" alt="写真" class="lazy-image" />
</div>
```

```css
.lazy-image {
  filter: blur(10px) brightness(1.1);
  transition: filter 0.5s ease-out;
}

.lazy-image.loaded {
  filter: blur(0) brightness(1);
}
```

```js
const img = document.querySelector('.lazy-image');
img.onload = () => img.classList.add('loaded');
// または IntersectionObserver を使用した遅延ローディング
```

### 実例2：モーダル背景のぼかし

```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
}

.modal {
  position: relative;
  z-index: 1001;
  /* modal の内容はぼかさない */
}
```

### 実例3：ホバーフィルター効果

```css
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.photo-card {
  overflow: hidden;
  border-radius: 8px;
}

.photo-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.5) brightness(0.9);
  transition: filter 0.3s, transform 0.3s;
}

.photo-card:hover img {
  filter: grayscale(0) brightness(1) saturate(1.2);
  transform: scale(1.05);
}
```

### 実例4：無効状態のスタイル

```css
.button {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: filter 0.2s;
}

.button:hover {
  filter: brightness(1.1);
}

.button:active {
  filter: brightness(0.9);
}

.button:disabled {
  filter: grayscale(1) opacity(0.6);
  cursor: not-allowed;
}
```

### 実例5：CSS 変数によるフィルター強度の制御

```css
:root {
  --blur-amount: 0px;
  --brightness-amount: 1;
  --grayscale-amount: 0;
}

.dynamic-filter {
  filter:
    blur(var(--blur-amount))
    brightness(var(--brightness-amount))
    grayscale(var(--grayscale-amount));
}
```

```js
// JS で動的に調整
document.documentElement.style.setProperty('--blur-amount', '5px');
document.documentElement.style.setProperty('--grayscale-amount', '0.5');
```

### 実例6：ダークモードの簡易対応

```css
/* シンプルで乱暴ですが効果的な方法 */
@media (prefers-color-scheme: dark) {
  html {
    filter: invert(1) hue-rotate(180deg);
  }

  /* 画像と動画は元の色に戻す */
  img, video, canvas {
    filter: invert(1) hue-rotate(180deg);
  }
}
```

この方法はラピッドプロトタイピングや移行期間に適しています。本番環境では CSS 変数とテーマカラー方式を使用することをお勧めします。

## filter アニメーションとパフォーマンス

### 使用 GPU 加速

filter アニメーションはデフォルトで GPU アクセラレーションを利用しますが、`blur` アニメーションの負荷は比較的高くなります。

```css
/* 推奨されるアニメーションプロパティ */
.smooth-transition {
  transition: filter 0.3s ease;
}

/* blur の頻繁なアニメーションは避ける */
/* 必要な場合は、ぼかし半径をできるだけ小さくする */
.expensive-blur {
  filter: blur(50px); /* 50px の blur アニメーションはパフォーマンスを消費します */
}

.cheap-blur {
  filter: blur(3px); /* 小半径の blur はパフォーマンスへの影響が小さい */
}
```

### パフォーマンス比較

```css
/* パフォーマンス負荷：低いものから順に */
filter: opacity(0.5);          /* 低 */
filter: grayscale(1);          /* 低 */
filter: brightness(1.2);      /* 低 */
filter: contrast(1.2);        /* 低 */
filter: saturate(1.5);        /* 中 */
filter: hue-rotate(90deg);    /* 中 */
filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3)); /* 中 */
filter: blur(20px);           /* 高 */
```

## backdrop-filter の互換性

`backdrop-filter` のブラウザサポート状況（2019 年）：

- Chrome 76+ — 対応（フラグを有効にするか、`-webkit-` プレフィックスが必要）
- Firefox 70+ — 対応
- Safari 9+ — 対応 `-webkit-backdrop-filter`
- Edge — `-webkit-` プレフィックスが必要
- IE — 未対応

```css
/* プログレッシブエンハンスメント */
.glass-effect {
  background: rgba(255, 255, 255, 0.8);
}

@supports (backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px)) {
  .glass-effect {
    background: rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}
```

## まとめ

- CSS `filter` は blur、brightness、contrast、grayscale、sepia、saturate、hue-rotate、invert、opacity、drop-shadow の 10 種類のフィルター関数を提供します
- 複数のフィルターを組み合わせて使用でき、宣言順に効果が重なります
- `backdrop-filter` は要素の背後にあるコンテンツにフィルターを適用し、すりガラス効果を実現します
- filter アニメーションのパフォーマンス負荷が低い順：opacity < grayscale < brightness < contrast < drop-shadow < blur
- CSS 変数を使用することで、動的なフィルター効果を正確に制御できます
- `drop-shadow` は `box-shadow` と異なり、要素の実際の内容（アルファチャンネル）に基づいて影を投影します
- `backdrop-filter` の互換性に注意し、`@supports` を使用したプログレッシブエンハンスメントを推奨します
