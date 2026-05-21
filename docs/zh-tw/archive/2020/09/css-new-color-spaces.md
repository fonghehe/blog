---
title: "CSS 新色彩空間 Lab/LCH 探索"
date: 2020-09-14 11:27:45
tags:
  - CSS
readingTime: 3
description: "最近在做設計系統的顏色體系，發現 CSS 顏色規範正在從 sRGB 向更廣的色彩空間擴充套件。Chrome 已經開始實驗性支援 `lab()`、`lch()`、`color()` 函式。雖然目前還不能用於生產，但作為前端工程師需要了解這些即將到來的變化。"
wordCount: 608
---

最近在做設計系統的顏色體系，發現 CSS 顏色規範正在從 sRGB 向更廣的色彩空間擴充套件。Chrome 已經開始實驗性支援 `lab()`、`lch()`、`color()` 函式。雖然目前還不能用於生產，但作為前端工程師需要了解這些即將到來的變化。

## 為什麼需要新的色彩空間

sRGB 能表示的顏色範圍（色域）有限。現在越來越多的裝置支援 Display P3 廣色域（所有 Apple 裝置、高階顯示器），如果 CSS 只用 sRGB，就無法充分利用這些硬體的能力。

更關鍵的是，sRGB 的色相在亮度變化時會丟失飽和度 —— 這就是為什麼你用 `hsl()` 調顏色時，把亮度調到 50% 的色相看起來和亮度 90% 完全不一樣。

## Lab 色彩空間

Lab（CIELAB）是一種感知均勻的色彩空間，三個通道：
- **L**：亮度，0（黑）到 100（白）
- **a**：紅-綠軸，負值偏綠，正值偏紅
- **b**：黃-藍軸，負值偏藍，正值偏黃

```css
/* Lab 語法 */
color: lab(50% 40 30);       /* 中等亮度，偏紅偏黃 */
color: lab(80% -20 -10);     /* 高亮度，偏綠偏藍 */
color: lab(20% 0 0);         /* 低亮度，中性灰 */

/* 帶透明度 */
color: lab(50% 40 30 / 0.8);
```

## LCH 色彩空間

LCH 是 Lab 的極座標表示，更直觀：
- **L**：亮度，0 到 100
- **C**：色度（飽和度），0（灰色）到 ~150（理論最大）
- **H**：色相角度，0-360 度

```css
/* LCH 語法 —— 和 HSL 類似但更直觀 */
color: lch(50% 60 0);        /* 中亮度，高飽和度，紅色 */
color: lch(50% 60 120);      /* 中亮度，高飽和度，綠色 */
color: lch(50% 60 240);      /* 中亮度，高飽和度，藍色 */

/* 淡色 —— 降低色度 */
color: lch(80% 20 270);      /* 高亮度，低飽和度，淡紫色 */

/* 灰色 —— 色度為 0 */
color: lch(50% 0 0);         /* 中性灰 */
```

## LCH vs HSL 的核心區別

這是最值得理解的部分。用 HSL 做設計系統的顏色梯度時，人眼感知到的亮度變化是不均勻的。LCH 解決了這個問題：

```css
/* HSL 的問題：相同的亮度值，不同色相看起來亮度差異很大 */
/* 這兩個都是 50% 亮度，但黃色看起來比藍色亮得多 */
.hsl-yellow { color: hsl(60, 100%, 50%); }
.hsl-blue   { color: hsl(240, 100%, 50%); }

/* LCH：相同的亮度值，不同色相看起來亮度一致 */
.lch-yellow { color: lch(60% 80 100); }
.lch-blue   { color: lch(60% 80 270); }
/* 人眼感知到的亮度是一樣的 */
```

## 實戰：用 LCH 構建顏色系統

LCH 特別適合構建設計系統的色彩梯度，因為只需調整亮度（L）就能得到一致的亮暗色階：

```css
:root {
  /* 基礎色 */
  --color-hue: 250;       /* 藍紫色 */
  --color-chroma: 80;     /* 飽和度 */

  /* 色階 —— 只需調整 L 值 */
  --color-50:  lch(97% calc(var(--color-chroma) * 0.1) var(--color-hue));
  --color-100: lch(93% calc(var(--color-chroma) * 0.2) var(--color-hue));
  --color-200: lch(85% calc(var(--color-chroma) * 0.4) var(--color-hue));
  --color-300: lch(75% calc(var(--color-chroma) * 0.6) var(--color-hue));
  --color-400: lch(65% calc(var(--color-chroma) * 0.8) var(--color-hue));
  --color-500: lch(55% var(--color-chroma) var(--color-hue));       /* 主色 */
  --color-600: lch(45% var(--color-chroma) var(--color-hue));
  --color-700: lch(35% var(--color-chroma) var(--color-hue));
  --color-800: lch(25% var(--color-chroma) var(--color-hue));
  --color-900: lch(15% var(--color-chroma) var(--color-hue));

  /* 語義色 */
  --color-success: lch(55% 70 145);    /* 綠色 */
  --color-warning: lch(75% 80 85);     /* 黃色 */
  --color-error:   lch(50% 80 25);     /* 紅色 */
  --color-info:    lch(55% 40 250);    /* 藍色 */
}
```

用 JavaScript 生成色階：

```typescript
// 用 Style Values API（未來 API）或者手動生成
function generateColorScale(hue: number, chroma: number) {
  const levels = [97, 93, 85, 75, 65, 55, 45, 35, 25, 15]
  const scaleFactors = [0.1, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1, 1]
  const stops = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

  return stops.reduce((acc, stop, i) => {
    acc[`--color-${stop}`] = `lch(${levels[i]}% ${chroma * scaleFactors[i]} ${hue})`
    return acc
  }, {} as Record<string, string>)
}

console.log(generateColorScale(250, 80))
```

## color() 函式：指定色域

`color()` 函式允許指定具體的色彩空間：

```css
/* sRGB 色域（預設） */
color: color(srgb 0.5 0.3 0.8);

/* Display P3 色域 —— 更廣的顏色範圍 */
color: color(display-p3 0.5 0.3 0.8);

/* 帶回退的寫法 */
.element {
  /* 降級到 sRGB */
  color: rgb(128, 77, 204);
  /* 廣色域覆蓋 */
  color: color(display-p3 0.5 0.3 0.8);
}
```

## 瀏覽器支援與漸進增強

目前（2020 年 9 月）Lab/LCH 還處於實驗階段。可以用 `@supports` 做漸進增強：

```css
.theme-primary {
  /* 基礎色：sRGB 回退 */
  color: rgb(90, 50, 180);
}

@supports (color: lab(50% 0 0)) {
  .theme-primary {
    color: lch(45% 80 290);
  }
}
```

```javascript
// JavaScript 中檢測支援
function supportsLab() {
  const el = document.createElement('div')
  el.style.color = 'lab(50% 0 0)'
  return el.style.color !== ''
}
```

## 小結

- Lab/LCH 是感知均勻的色彩空間，人眼感知到的亮度變化更線性
- LCH 適合構建設計系統色彩梯度，調整亮度時色相和飽和度保持穩定
- LCH 相比 HSL 的核心優勢是亮度感知均勻
- `color()` 函式支援指定色域，可以利用 Display P3 廣色域
- 目前瀏覽器支援度有限，建議用 `@supports` 做漸進增強
- 這是 CSS 顏色規範的未來方向，值得提前學習
