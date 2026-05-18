---
title: "CSS 新色彩空间 Lab/LCH 探索"
date: 2020-09-14 11:27:45
tags:
  - CSS
readingTime: 3
description: "最近在做设计系统的颜色体系，发现 CSS 颜色规范正在从 sRGB 向更广的色彩空间扩展。Chrome 已经开始实验性支持 `lab()`、`lch()`、`color()` 函数。虽然目前还不能用于生产，但作为前端工程师需要了解这些即将到来的变化。"
---

最近在做设计系统的颜色体系，发现 CSS 颜色规范正在从 sRGB 向更广的色彩空间扩展。Chrome 已经开始实验性支持 `lab()`、`lch()`、`color()` 函数。虽然目前还不能用于生产，但作为前端工程师需要了解这些即将到来的变化。

## 为什么需要新的色彩空间

sRGB 能表示的颜色范围（色域）有限。现在越来越多的设备支持 Display P3 广色域（所有 Apple 设备、高端显示器），如果 CSS 只用 sRGB，就无法充分利用这些硬件的能力。

更关键的是，sRGB 的色相在亮度变化时会丢失饱和度 —— 这就是为什么你用 `hsl()` 调颜色时，把亮度调到 50% 的色相看起来和亮度 90% 完全不一样。

## Lab 色彩空间

Lab（CIELAB）是一种感知均匀的色彩空间，三个通道：
- **L**：亮度，0（黑）到 100（白）
- **a**：红-绿轴，负值偏绿，正值偏红
- **b**：黄-蓝轴，负值偏蓝，正值偏黄

```css
/* Lab 语法 */
color: lab(50% 40 30);       /* 中等亮度，偏红偏黄 */
color: lab(80% -20 -10);     /* 高亮度，偏绿偏蓝 */
color: lab(20% 0 0);         /* 低亮度，中性灰 */

/* 带透明度 */
color: lab(50% 40 30 / 0.8);
```

## LCH 色彩空间

LCH 是 Lab 的极坐标表示，更直观：
- **L**：亮度，0 到 100
- **C**：色度（饱和度），0（灰色）到 ~150（理论最大）
- **H**：色相角度，0-360 度

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

## LCH vs HSL 的核心区别

这是最值得理解的部分。用 HSL 做设计系统的颜色梯度时，人眼感知到的亮度变化是不均匀的。LCH 解决了这个问题：

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

## 实战：用 LCH 构建颜色系统

LCH 特别适合构建设计系统的色彩梯度，因为只需调整亮度（L）就能得到一致的亮暗色阶：

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

用 JavaScript 生成色阶：

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

## color() 函数：指定色域

`color()` 函数允许指定具体的色彩空间：

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

## 浏览器支持与渐进增强

目前（2020 年 9 月）Lab/LCH 还处于实验阶段。可以用 `@supports` 做渐进增强：

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

## 小结

- Lab/LCH 是感知均匀的色彩空间，人眼感知到的亮度变化更线性
- LCH 适合构建设计系统色彩梯度，调整亮度时色相和饱和度保持稳定
- LCH 相比 HSL 的核心优势是亮度感知均匀
- `color()` 函数支持指定色域，可以利用 Display P3 广色域
- 目前浏览器支持度有限，建议用 `@supports` 做渐进增强
- 这是 CSS 颜色规范的未来方向，值得提前学习
