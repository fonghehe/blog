---
title: "Exploring the CSS Houdini Paint API"
date: 2019-10-03 15:32:59
tags:
  - CSS
readingTime: 4
description: "CSS Houdini 是 W3C 提出的一组底层 CSS API，它让开发者可以直接接入 CSS 渲染引擎的各个阶段。其中 Paint API 是目前浏览器支持度最好的一个，它允许我们用 JavaScript 绘制自定义的 CSS 图案，替代传统的背景图方案。"
wordCount: 663
---

CSS Houdini 是 W3C 提出的一组底层 CSS API，它让开发者可以直接接入 CSS 渲染引擎的各个阶段。其中 Paint API 是目前浏览器支持度最好的一个，它允许我们用 JavaScript 绘制自定义的 CSS 图案，替代传统的背景图方案。

## What Is the CSS Paint API

传统方式下，如果我们想实现一个复杂的背景效果（比如渐变网格、波浪线、动态斑点），要么用 CSS 渐变拼凑，要么用图片，要么用 SVG。CSS Paint API 提供了第四种方案：用 JavaScript 编写绘制逻辑，然后像 CSS 函数一样直接调用。

```css
/* 传统方式 */
.box {
  background: url('dots.png') repeat;
}

/* Paint API 方式 */
.box {
  background: paint(dots);
}
```

核心概念包括：

- **Worklet**：运行在独立线程中的轻量级 JS 模块
- **registerPaint()**：注册一个绘制处理器
- **paint()**：实际的绘制回调函数

## Browser Support and Detection

截至目前，Chrome 65+ 已经完整支持 Paint API，Edge 基于 Chromium 也支持，Firefox 和 Safari 暂未默认开启。

```js
// 检测浏览器支持
if ('paintWorklet' in CSS) {
  console.log('CSS Paint API 可用');
} else {
  console.log('需要 polyfill 或降级方案');
}
```

可以使用 [css-paint-polyfill](https://github.com/GoogleChromeLabs/css-paint-polyfill) 做兼容：

```html
<script src="https://unpkg.com/css-paint-polyfill"></script>
```

## Registering Your First Paint Worklet

创建一个独立的 JS 文件作为 Worklet，在其中使用 `registerPaint` 注册绘制器。Worklet 中可以使用的绘图 API 是 Canvas 2D API 的一个子集：

```js
// worklets/dots.js
class DotsPainter {
  // 声明此绘制器依赖的 CSS 属性
  static get inputProperties() {
    return [
      '--dot-color',
      '--dot-size',
      '--dot-spacing'
    ];
  }

  // 绘制回调
  paint(ctx, size, properties) {
    const dotColor = properties.get('--dot-color').toString().trim() || '#3498db';
    const dotSize = parseFloat(properties.get('--dot-size').toString()) || 4;
    const spacing = parseFloat(properties.get('--dot-spacing').toString()) || 20;

    ctx.fillStyle = dotColor;

    for (let x = 0; x < size.width; x += spacing) {
      for (let y = 0; y < size.height; y += spacing) {
        ctx.beginPath();
        ctx.arc(x + spacing / 2, y + spacing / 2, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

registerPaint('dots', DotsPainter);
```

在页面中加载 Worklet：

```js
// 主线程中注册
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('/worklets/dots.js');
}
```

然后就可以在 CSS 中使用了：

```css
.dot-box {
  --dot-color: #e74c3c;
  --dot-size: 3;
  --dot-spacing: 24;
  background: paint(dots);
  width: 400px;
  height: 300px;
}
```

## Using inputProperties to React to CSS Variables

Paint API 最强大的地方在于它可以读取 CSS 自定义属性（CSS Variables），这意味着绘制行为可以完全由 CSS 控制：

```js
class GradientWavePainter {
  static get inputProperties() {
    return [
      '--wave-color',
      '--wave-amplitude',
      '--wave-frequency',
      '--wave-offset'
    ];
  }

  paint(ctx, size, properties) {
    const color = properties.get('--wave-color').toString().trim() || '#667eea';
    const amplitude = parseFloat(properties.get('--wave-amplitude').toString()) || 30;
    const frequency = parseFloat(properties.get('--wave-frequency').toString()) || 0.02;
    const offset = parseFloat(properties.get('--wave-offset').toString()) || 0;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size.height);

    for (let x = 0; x <= size.width; x++) {
      const y = size.height / 2 + Math.sin((x * frequency) + offset) * amplitude;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(size.width, size.height);
    ctx.closePath();
    ctx.fill();
  }
}

registerPaint('wave', GradientWavePainter);
```

CSS 部分：

```css
.wave-section {
  --wave-color: rgba(102, 126, 234, 0.5);
  --wave-amplitude: 40;
  --wave-frequency: 0.015;
  --wave-offset: 0;
  background: paint(wave);
}
```

## In Practice: Custom Border Painter

一个常见的需求是自定义边框样式，比如锯齿边框：

```js
class ZigzagPainter {
  static get inputProperties() {
    return [
      '--zigzag-color',
      '--zigzag-size'
    ];
  }

  paint(ctx, size, properties) {
    const color = properties.get('--zigzag-color').toString().trim() || '#333';
    const zigSize = parseFloat(properties.get('--zigzag-size').toString()) || 10;

    ctx.fillStyle = color;

    // 顶部锯齿
    for (let x = 0; x < size.width; x += zigSize * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + zigSize, zigSize);
      ctx.lineTo(x + zigSize * 2, 0);
      ctx.fill();
    }

    // 底部锯齿
    for (let x = 0; x < size.width; x += zigSize * 2) {
      ctx.beginPath();
      ctx.moveTo(x, size.height);
      ctx.lineTo(x + zigSize, size.height - zigSize);
      ctx.lineTo(x + zigSize * 2, size.height);
      ctx.fill();
    }
  }
}

registerPaint('zigzag', ZigzagPainter);
```

## Implementing Animation Effects

Worklet 运行在独立线程，不能直接访问 DOM 或使用 `requestAnimationFrame`。动画需要在主线程中通过修改 CSS 变量来触发重绘：

```js
// 主线程代码
function animateWave() {
  const el = document.querySelector('.wave-section');
  let offset = 0;

  function frame() {
    offset += 0.05;
    el.style.setProperty('--wave-offset', offset);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

animateWave();
```

## In Practice: Skeleton Loading Placeholder

```js
class SkeletonPainter {
  static get inputProperties() {
    return [
      '--skeleton-base-color',
      '--skeleton-shine-color',
      '--skeleton-progress'
    ];
  }

  paint(ctx, size, properties) {
    const baseColor = properties.get('--skeleton-base-color').toString().trim() || '#e0e0e0';
    const shineColor = properties.get('--skeleton-shine-color').toString().trim() || '#f5f5f5';
    const progress = parseFloat(properties.get('--skeleton-progress').toString()) || 0;

    // 底色
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size.width, size.height);

    // 闪光扫过效果
    const shineX = (size.width + 200) * progress - 100;
    const gradient = ctx.createLinearGradient(shineX, 0, shineX + 200, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, shineColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

registerPaint('skeleton', SkeletonPainter);
```

配合主线程动画：

```js
CSS.paintWorklet.addModule('/worklets/skeleton.js');

function startSkeletonAnimation() {
  const el = document.querySelector('.skeleton-box');
  let progress = 0;

  function frame() {
    progress = (progress + 0.005) % 1;
    el.style.setProperty('--skeleton-progress', progress);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
```

## Comparison with Canvas

| 特性 | Paint API | Canvas |
|------|-----------|--------|
| 运行线程 | Worklet 线程 | 主线程 |
| 与 CSS 集成 | 天然集成，可直接用作 background | 需要手动设置 |
| 响应式 | 自动随元素尺寸变化 | 需要手动监听 resize |
| DOM 访问 | 不可访问 | 可访问 |
| 事件处理 | 不支持 | 支持 |

## Summary

- CSS Paint API 是 Houdini 规范中最成熟的模块，Chrome 已完整支持
- 通过 `registerPaint()` 注册绘制器，用 Canvas 2D 子集 API 绘制
- `inputProperties` 可以读取 CSS 自定义属性，实现声明式控制
- Worklet 运行在独立线程，不会阻塞主线程
- 适合用于背景图案、边框装饰、占位图等纯视觉效果
- 动画需要在主线程修改 CSS 变量来触发重绘
- 可以通过 css-paint-polyfill 做降级兼容
