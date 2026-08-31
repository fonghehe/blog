---
title: "Exploring New CSS Color Spaces: Lab and LCH"
date: 2020-09-14 11:27:45
tags:
  - CSS
readingTime: 3
description: "An exploration of new CSS color spaces like Lab and LCH as the spec expands beyond sRGB, including experimental browser support and what frontend engineers need to know."
wordCount: 416
---

I've been working on the color system for a design system lately, and I noticed that the CSS color spec is expanding beyond sRGB into wider color spaces. Chrome has started experimentally supporting the `lab()`, `lch()`, and `color()` functions. They aren't production-ready yet, but as frontend engineers we should understand the changes that are coming.

## Why New Color Spaces Are Needed

sRGB can only represent a limited range of colors (its gamut). More and more devices now support the wider Display P3 gamut (all Apple devices, high-end displays), and if CSS sticks to sRGB we can't take advantage of that hardware.

More importantly, sRGB loses saturation in its hues as lightness changes — that's why, when you tune colors with `hsl()`, a hue at 50% lightness looks completely different from the same hue at 90% lightness.

## The Lab Color Space

Lab (CIELAB) is a perceptually uniform color space with three channels:

- **L**: lightness, 0 (black) to 100 (white)
- **a**: red–green axis, negative leans green, positive leans red
- **b**: yellow–blue axis, negative leans blue, positive leans yellow

```css
/* Lab 语法 */
color: lab(50% 40 30);       /* 中等亮度，偏红偏黄 */
color: lab(80% -20 -10);     /* 高亮度，偏绿偏蓝 */
color: lab(20% 0 0);         /* 低亮度，中性灰 */

/* 带透明度 */
color: lab(50% 40 30 / 0.8);
```

## The LCH Color Space

LCH is the polar-coordinate form of Lab, and is more intuitive:

- **L**: lightness, 0 to 100
- **C**: chroma (saturation), 0 (gray) to ~150 (theoretical max)
- **H**: hue angle, 0–360 degrees

```css
/* LCH 语法 —— 和 HSL 类似但更直观 */
color: lch(50% 60 0);        /* 中亮度，高饱和度，红色 */
color: lch(50% 60 120);      /* 中亮度，高饱和度，绿色 */
color: lch(50% 60 240);      /* 中亮度，高饱和度，蓝色 */

/* 淡色 —— 降低色度 */
color: lch(80% 20 270);      /* 高亮度，低饱和度，淡紫色 */

/* 灰色 —— 色度为 0 */
color: lch(50% 0 0);         /* 中性灰 */
```

## The Core Difference Between LCH and HSL

This is the part most worth understanding. When you build a color gradient for a design system with HSL, the lightness changes the human eye perceives are uneven. LCH fixes this:

```css
/* HSL 的问题：相同的亮度值，不同色相看起来亮度差异很大 */
/* 这两个都是 50% 亮度，但黄色看起来比蓝色亮得多 */
.hsl-yellow { color: hsl(60, 100%, 50%); }
.hsl-blue   { color: hsl(240, 100%, 50%); }

/* LCH：相同的亮度值，不同色相看起来亮度一致 */
.lch-yellow { color: lch(60% 80 100); }
.lch-blue   { color: lch(60% 80 270); }
/* 人眼感知到的亮度是一样的 */
```

## In Practice: Building a Color System with LCH

LCH is especially well suited to building color gradients for design systems, because you only need to adjust lightness (L) to get a consistent light-to-dark scale:

```css
:root {
  /* 基础色 */
  --color-hue: 250;       /* 蓝紫色 */
  --color-chroma: 80;     /* 饱和度 */

  /* 色阶 —— 只需调整 L 值 */
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

  /* 语义色 */
  --color-success: lch(55% 70 145);    /* 绿色 */
  --color-warning: lch(75% 80 85);     /* 黄色 */
  --color-error:   lch(50% 80 25);     /* 红色 */
  --color-info:    lch(55% 40 250);    /* 蓝色 */
}
```

Generating the scale with JavaScript:

```typescript
// 用 Style Values API（未来 API）或者手动生成
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

## The color() Function: Specifying a Gamut

The `color()` function lets you specify a concrete color space:

```css
/* sRGB 色域（默认） */
color: color(srgb 0.5 0.3 0.8);

/* Display P3 色域 —— 更广的颜色范围 */
color: color(display-p3 0.5 0.3 0.8);

/* 带回退的写法 */
.element {
  /* 降级到 sRGB */
  color: rgb(128, 77, 204);
  /* 广色域覆盖 */
  color: color(display-p3 0.5 0.3 0.8);
}
```

## Browser Support and Progressive Enhancement

As of now (September 2020), Lab/LCH are still experimental. You can use `@supports` for progressive enhancement:

```css
.theme-primary {
  /* 基础色：sRGB 回退 */
  color: rgb(90, 50, 180);
}

@supports (color: lab(50% 0 0)) {
  .theme-primary {
    color: lch(45% 80 290);
  }
}
```

```javascript
// JavaScript 中检测支持
function supportsLab() {
  const el = document.createElement('div')
  el.style.color = 'lab(50% 0 0)'
  return el.style.color !== ''
}
```

## Summary

- Lab/LCH are perceptually uniform color spaces, where the lightness changes the human eye perceives are more linear.
- LCH is well suited to building color gradients for design systems; when you adjust lightness, hue and saturation stay stable.
- LCH's core advantage over HSL is uniform perceptual lightness.
- The `color()` function lets you specify a gamut and take advantage of the wide Display P3 gamut.
- Browser support is still limited today, so use `@supports` for progressive enhancement.
- This is the future direction of the CSS color spec, and worth learning ahead of time.
