---
title: "Solving the Mobile 1px Border Problem Once and For All"
date: 2018-04-29 16:15:47
tags:
  - Mobile
readingTime: 1
description: "The mobile 1px problem is a classic issue you must solve when building mobile pages. The root cause is the Device Pixel Ratio (DPR)."
wordCount: 113
---

The mobile 1px problem is a classic issue you must solve when building mobile pages. The root cause is the Device Pixel Ratio (DPR).

## Why Does This Happen

```
iPhone 6 screen:
  Physical resolution: 750 × 1334 pixels
  Logical resolution:  375 × 667 CSS pixels
  DPR (Device Pixel Ratio): 2

So CSS 1px = 2 physical pixels
On Retina screens, it looks "thicker" than the design spec
```

## Solution 1: transform Scale (Recommended)

```css
/* Universal pattern */
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

/* Scale based on DPR */
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
/* SCSS version — easier to reuse */
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

Four-sided version:

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

## Solution 2: viewport meta + rem

```html
<!-- Dynamically set initial-scale so 1px CSS = 1 physical pixel -->
<meta name="viewport" content="width=device-width,initial-scale=0.5" />
```

```javascript
// Set viewport based on DPR
const dpr = window.devicePixelRatio;
const meta = document.querySelector('meta[name="viewport"]');
meta.content = `width=device-width,initial-scale=${1 / dpr},maximum-scale=${1 / dpr},minimum-scale=${1 / dpr}`;
```

This approach scales the entire page and has larger side effects. Generally used together with the rem approach.

## Solution 3: box-shadow Simulation

```css
.border-box {
  box-shadow: 0 0 0 0.5px #e5e5e5;
}
```

Simple, but only works for rectangles — rounded corners aren't well supported.

## Which to Choose in Practice

```
Most cases: Solution 1 (transform scaleY)
  Pros: precise, universal, doesn't affect layout
  Cons: requires position: relative, slightly verbose

If using flexible.js (rem approach): Solution 2
  The entire page scales by DPR, so 1px is 1px

Simple borders only: Solution 3 (box-shadow)
```

## Summary

- Root cause: Retina screens have DPR > 1, so CSS 1px = 2 physical pixels
- Recommended: `::after` pseudo-element + `transform: scaleY(0.5)`
- Wrap in a SCSS mixin for reuse wherever 1px borders are needed
