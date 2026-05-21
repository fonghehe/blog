---
title: "モバイル 1px ボーダー問題の完全解決"
date: 2018-04-29 16:15:47
tags:
  - モバイル
readingTime: 2
description: "モバイル 1px 問題はスマートフォン向けページを作る際に必ず解決しなければならない古典的な問題です。根本原因はデバイスピクセル比（DPR）にあります。"
wordCount: 263
---

モバイル 1px 問題はスマートフォン向けページを作る際に必ず解決しなければならない古典的な問題です。根本原因はデバイスピクセル比（DPR）にあります。

## なぜ発生するのか

```
iPhone 6 の画面：
  物理解像度：750 × 1334 ピクセル
  論理解像度：375 × 667 CSS ピクセル
  DPR（デバイスピクセル比）：2

つまり CSS の 1px = 2 物理ピクセル
Retina スクリーンではデザイン仕様より「太く」見える
```

## 解決策 1：transform スケール（推奨）

```css
/* 汎用パターン */
.border-bottom {
  position: relative;
}

.border-bottom::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background-color: #e5e5e5;
  transform-origin: 0 0;
}

/* DPR に応じてスケール */
@media (-webkit-min-device-pixel-ratio: 2) {
  .border-bottom::after {
    transform: scaleY(0.5);
  }
}

@media (-webkit-min-device-pixel-ratio: 3) {
  .border-bottom::after {
    transform: scaleY(0.333);
  }
}
```

```scss
/* SCSS 版 — 再利用しやすい */
@mixin hairline-bottom($color: #e5e5e5) {
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    background: $color;
    transform-origin: 0 bottom;

    @media (-webkit-min-device-pixel-ratio: 2) {
      transform: scaleY(0.5);
    }
    @media (-webkit-min-device-pixel-ratio: 3) {
      transform: scaleY(0.3333);
    }
  }
}

.list-item {
  @include hairline-bottom;
}
```

四辺版：

```scss
@mixin hairline-surround($color: #e5e5e5, $radius: 0) {
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 200%;
    height: 200%;
    border: 1px solid $color;
    border-radius: $radius * 2;
    transform-origin: 0 0;
    transform: scale(0.5);
    pointer-events: none;
    box-sizing: border-box;
  }
}
```

## 解決策 2：viewport meta + rem

```html
<!-- initial-scale を動的に設定して CSS 1px = 1 物理ピクセルにする -->
<meta name="viewport" content="width=device-width,initial-scale=0.5" />
```

```javascript
// DPR に基づいて viewport を設定
const dpr = window.devicePixelRatio;
const meta = document.querySelector('meta[name="viewport"]');
meta.content = `width=device-width,initial-scale=${1 / dpr},maximum-scale=${1 / dpr},minimum-scale=${1 / dpr}`;
```

この方法はページ全体をスケールするため副作用が大きく、一般的に rem 方式と組み合わせて使います。

## 解決策 3：box-shadow で模倣

```css
.border-box {
  box-shadow: 0 0 0 0.5px #e5e5e5;
}
```

シンプルですが、矩形にしか対応しておらず、角丸のサポートが不十分です。

## 実際のプロジェクトでの選び方

```
ほとんどの場合：解決策 1（transform scaleY）
  メリット：正確、汎用的、レイアウトに影響しない
  デメリット：position: relative が必要で少し手間

flexible.js（rem 方式）を使っている場合：解決策 2
  ページ全体が DPR でスケールするため、1px が 1px になる

シンプルなボーダーのみ：解決策 3（box-shadow）
```

## まとめ

- 根本原因：Retina スクリーンの DPR > 1 のため、CSS 1px = 2 物理ピクセル
- 推奨：`::after` 疑似要素 + `transform: scaleY(0.5)`
- SCSS mixin としてカプセル化し、1px ボーダーが必要な場所で再利用する
