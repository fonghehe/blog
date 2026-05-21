---
title: "移動端 1px 邊框問題徹底解決"
date: 2018-04-29 16:15:47
tags:
  - 移動端
readingTime: 1
description: "移動端 1px 問題是做手機頁面必須解決的經典問題。根本原因是裝置畫素比（DPR）。"
wordCount: 168
---

移動端 1px 問題是做手機頁面必須解決的經典問題。根本原因是裝置畫素比（DPR）。

## 為什麼會出現這個問題

```
iPhone 6 的螢幕：
  物理解析度：750 × 1334 畫素
  邏輯解析度：375 × 667 CSS 畫素
  DPR（裝置畫素比）：2

所以 CSS 裡寫 1px，實際顯示是 2 個物理畫素寬
在 Retina 螢幕上看起來比設計稿要"粗"
```

## 方案一：transform 縮放（推薦）

```css
/* 通用 mixin */
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

/* 根據 DPR 縮放 */
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
/* SCSS 版本，更方便複用 */
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

四條邊的版本：

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

## 方案二：viewport meta + rem

```html
<!-- 動態設定 initial-scale，讓 1px CSS 等於 1px 物理畫素 -->
<meta name="viewport" content="width=device-width,initial-scale=0.5" />
```

```javascript
// 根據 DPR 動態設定 viewport
const dpr = window.devicePixelRatio;
const meta = document.querySelector('meta[name="viewport"]');
meta.content = `width=device-width,initial-scale=${1 / dpr},maximum-scale=${1 / dpr},minimum-scale=${1 / dpr}`;
```

這個方案讓整個頁面縮放，副作用較大，一般配合 rem 方案一起用。

## 方案三：box-shadow 模擬

```css
.border-box {
  box-shadow: 0 0 0 0.5px #e5e5e5;
}
```

簡單，但只適合矩形，圓角支援不好。

## 實際專案怎麼選

```
大多數情況：方案一（transform scaleY）
  優點：精確、通用、不影響佈局
  缺點：需要 position: relative，略繁瑣

配了 flexible.js（rem 方案）：方案二
  整個頁面按 DPR 縮放，1px 就是 1px

極簡單的邊框：方案三（box-shadow）
```

## 小結

- 根本原因：Retina 屏 DPR > 1，CSS 1px = 2 個物理畫素
- 推薦方案：`::after` 偽元素 + `transform: scaleY(0.5)`
- 用 SCSS mixin 封裝，所有需要 1px 邊框的地方複用