---
title: "移动端 1px 边框问题彻底解决"
date: 2018-04-29 16:15:47
tags:
  - 移动端
---

移动端 1px 问题是做手机页面必须解决的经典问题。根本原因是设备像素比（DPR）。

## 为什么会出现这个问题

```
iPhone 6 的屏幕：
  物理分辨率：750 × 1334 像素
  逻辑分辨率：375 × 667 CSS 像素
  DPR（设备像素比）：2

所以 CSS 里写 1px，实际显示是 2 个物理像素宽
在 Retina 屏幕上看起来比设计稿要"粗"
```

## 方案一：transform 缩放（推荐）

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

/* 根据 DPR 缩放 */
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
/* SCSS 版本，更方便复用 */
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

四条边的版本：

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
<!-- 动态设置 initial-scale，让 1px CSS 等于 1px 物理像素 -->
<meta name="viewport" content="width=device-width,initial-scale=0.5" />
```

```javascript
// 根据 DPR 动态设置 viewport
const dpr = window.devicePixelRatio;
const meta = document.querySelector('meta[name="viewport"]');
meta.content = `width=device-width,initial-scale=${1 / dpr},maximum-scale=${1 / dpr},minimum-scale=${1 / dpr}`;
```

这个方案让整个页面缩放，副作用较大，一般配合 rem 方案一起用。

## 方案三：box-shadow 模拟

```css
.border-box {
  box-shadow: 0 0 0 0.5px #e5e5e5;
}
```

简单，但只适合矩形，圆角支持不好。

## 实际项目怎么选

```
大多数情况：方案一（transform scaleY）
  优点：精确、通用、不影响布局
  缺点：需要 position: relative，略繁琐

配了 flexible.js（rem 方案）：方案二
  整个页面按 DPR 缩放，1px 就是 1px

极简单的边框：方案三（box-shadow）
```

## 小结

- 根本原因：Retina 屏 DPR > 1，CSS 1px = 2 个物理像素
- 推荐方案：`::after` 伪元素 + `transform: scaleY(0.5)`
- 用 SCSS mixin 封装，所有需要 1px 边框的地方复用