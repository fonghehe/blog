---
title: "CSS filter Effects in Practice"
date: 2019-08-28 10:01:02
tags:
  - CSS
readingTime: 3
description: "The CSS `filter` property lets you apply a wide range of visual effects to an element—blur, grayscale, contrast adjustment, drop shadows, and more—without touching the underlying image assets. It comes in handy for image processing, UI animation, dark-mode adaptation, and similar scenarios. This article walks through each `filter` function and shows how to combine them through practical examples."
wordCount: 313
---

CSS `filter` lets you apply a wide range of visual effects to an element—blur, grayscale, contrast adjustment, drop shadows, and more—without touching the underlying image assets. It comes in handy for image processing, UI animation, dark-mode adaptation, and similar scenarios. This article walks through each `filter` function and shows how to combine them through practical examples.

## Filter Basic Syntax

```css
.element {
  filter: <function>(<value>);
  /* 多个滤镜可以叠加 */
  filter: blur(5px) brightness(1.2) contrast(0.8);
}
```

## Filter Function Reference

### blur — Gaussian Blur

```css
/* 值为长度单位，值越大越模糊 */
.card-bg {
  filter: blur(20px);
}

/* 常见的毛玻璃效果 */
.frosted-glass {
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);  /* 注意：backdrop-filter 是另一个属性 */
  -webkit-backdrop-filter: blur(10px);
}
```

### brightness — Brightness

```css
/* 0 = 全黑, 1 = 原始, >1 = 更亮 */
.hover-bright:hover {
  filter: brightness(1.2);
}

/* 变暗 */
.dim {
  filter: brightness(0.6);
}
```

### contrast — Contrast

```css
/* 1 = 原始, <1 降低对比度, >1 增加对比度 */
.high-contrast {
  filter: contrast(1.5);
}

.low-contrast {
  filter: contrast(0.5);
}
```

### grayscale — Grayscale

```css
/* 0 = 彩色, 1 = 完全灰度 */
.grayscale {
  filter: grayscale(1);
}

/* 哀悼日全站变灰 */
body.mourning {
  filter: grayscale(1);
}

/* hover 时恢复彩色 */
.gallery-item {
  filter: grayscale(0.8);
  transition: filter 0.3s;
}
.gallery-item:hover {
  filter: grayscale(0);
}
```

### sepia — Sepia Tone

```css
/* 0 = 原始, 1 = 完全复古 */
.vintage-photo {
  filter: sepia(0.8);
}
```

### saturate — Saturation

```css
/* 0 = 无饱和（灰度）, 1 = 原始, >1 = 过饱和 */
.vibrant {
  filter: saturate(1.5);
}

.muted {
  filter: saturate(0.5);
}
```

### hue-rotate — Hue Rotation

```css
/* 值为角度，旋转色相 */
.color-shift {
  filter: hue-rotate(90deg);
}

/* 动态色彩变换动画 */
@keyframes rainbow {
  from { filter: hue-rotate(0deg); }
  to { filter: hue-rotate(360deg); }
}

.rainbow-effect {
  animation: rainbow 3s linear infinite;
}
```

### invert — Invert

```css
/* 0 = 原始, 1 = 完全反色 */
.inverted {
  filter: invert(1);
}

/* 反色常用于快速实现暗黑模式 */
.quick-dark-mode {
  filter: invert(1) hue-rotate(180deg);
}
/* hue-rotate(180deg) 把反色后的颜色再转回来，避免照片看起来奇怪 */
```

### opacity — Opacity

```css
/* 与 CSS opacity 类似，但可以与其他 filter 组合 */
.transparent {
  filter: opacity(0.5);
}

/* 与对比度组合 */
.muted-card {
  filter: opacity(0.8) contrast(0.9);
}
```

### drop-shadow — Drop Shadow

```css
/* 类似 box-shadow，但可以应用于不规则形状 */
.icon-shadow {
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.3));
}

/* drop-shadow 对透明 PNG 图片有效 */
.png-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* box-shadow 只作用于元素的矩形边界 */
/* drop-shadow 根据元素实际内容（alpha 通道）投影 */
```

## Practical Cases

### Case 1: Image Loading Transition

```html
<div class="image-wrapper">
  <img src="photo.jpg" alt="照片" class="lazy-image" />
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
// 或使用 IntersectionObserver 懒加载
```

### Case 2: Modal Background Blur

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
  /* modal 内容不模糊 */
}
```

### Case 3: Hover Filter Effect

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

### Case 4: Disabled State Styling

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

### Case 5: Controlling Filter Intensity with CSS Variables

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
// 通过 JS 动态调整
document.documentElement.style.setProperty('--blur-amount', '5px');
document.documentElement.style.setProperty('--grayscale-amount', '0.5');
```

### Case 6: Quick Dark-Mode Adaptation

```css
/* 简单粗暴但有效的方法 */
@media (prefers-color-scheme: dark) {
  html {
    filter: invert(1) hue-rotate(180deg);
  }

  /* 图片和视频恢复原色 */
  img, video, canvas {
    filter: invert(1) hue-rotate(180deg);
  }
}
```

This approach works for quick prototypes or a transition period, but for production you should still use CSS variables and a proper theme-color scheme.

## Filter Animation and Performance

### Using GPU Acceleration

Filter animations trigger GPU acceleration by default, but animating `blur` is relatively expensive:

```css
/* 推荐的动画属性 */
.smooth-transition {
  transition: filter 0.3s ease;
}

/* 避免对 blur 做频繁动画 */
/* 如果必须，尽量减小模糊半径 */
.expensive-blur {
  filter: blur(50px); /* 50px 的 blur 动画很耗性能 */
}

.cheap-blur {
  filter: blur(3px); /* 小半径的 blur 性能影响较小 */
}
```

### Performance Comparison

```css
/* 性能开销从小到大 */
filter: opacity(0.5);          /* 低 */
filter: grayscale(1);          /* 低 */
filter: brightness(1.2);      /* 低 */
filter: contrast(1.2);        /* 低 */
filter: saturate(1.5);        /* 中 */
filter: hue-rotate(90deg);    /* 中 */
filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3)); /* 中 */
filter: blur(20px);           /* 高 */
```

## backdrop-filter Compatibility

Browser support for `backdrop-filter` (as of 2019):

- Chrome 76+ — supported (requires enabling a flag or using the `-webkit-` prefix)
- Firefox 70+ — supported
- Safari 9+ — supports `-webkit-backdrop-filter`
- Edge — requires the `-webkit-` prefix
- IE — not supported

```css
/* 渐进增强 */
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

## Summary

- CSS `filter` provides ten filter functions: `blur`, `brightness`, `contrast`, `grayscale`, `sepia`, `saturate`, `hue-rotate`, `invert`, `opacity`, and `drop-shadow`.
- Multiple filters can be combined; they stack in declaration order.
- `backdrop-filter` applies a filter to the content behind an element, producing the frosted-glass effect.
- Filter animation cost, from cheapest to most expensive: opacity < grayscale < brightness < contrast < drop-shadow < blur.
- CSS variables let you precisely control filter effects dynamically.
- Unlike `box-shadow`, `drop-shadow` casts a shadow based on the element's actual content (the alpha channel).
- Watch `backdrop-filter` browser support, and prefer progressive enhancement with `@supports`.
