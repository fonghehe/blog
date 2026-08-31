---
title: "Exploring the CSS Houdini Paint API"
date: 2019-10-03 15:32:59
tags:
  - CSS
readingTime: 4
description: "CSS Houdini is a set of low-level CSS APIs proposed by the W3C that let developers hook directly into the various stages of the CSS rendering engine. Among them, the Paint API currently has the widest browser support—it lets us draw custom CSS patterns in JavaScript instead of relying on traditional background images."
wordCount: 459
---

CSS Houdini is a set of low-level CSS APIs proposed by the W3C that let developers hook directly into the various stages of the CSS rendering engine. Among them, the Paint API currently has the widest browser support—it lets us draw custom CSS patterns in JavaScript instead of relying on traditional background images.

## What Is the CSS Paint API

Traditionally, if you wanted a complex background effect (say, a gradient mesh, wavy lines, or animated dots), you'd cobble something together with CSS gradients, reach for an image, or use SVG. The CSS Paint API offers a fourth option: write the drawing logic in JavaScript and then call it just like a CSS function.

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

The core concepts are:

- **Worklet**: a lightweight JS module that runs on a separate thread
- **registerPaint()**: registers a paint handler
- **paint()**: the actual paint callback

## Browser Support and Detection

As of now, Chrome 65+ fully supports the Paint API, and Chromium-based Edge does too, while Firefox and Safari don't enable it by default.

```js
// 检测浏览器支持
if ('paintWorklet' in CSS) {
  console.log('CSS Paint API 可用');
} else {
  console.log('需要 polyfill 或降级方案');
}
```

You can use [css-paint-polyfill](https://github.com/GoogleChromeLabs/css-paint-polyfill) for compatibility:

```html
<script src="https://unpkg.com/css-paint-polyfill"></script>
```

## Registering Your First Paint Worklet

Create a standalone JS file as a Worklet and register the painter with `registerPaint`. The drawing API available inside a Worklet is a subset of the Canvas 2D API:

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

Load the Worklet in the page:

```js
// 主线程中注册
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('/worklets/dots.js');
}
```

You can then use it in CSS:

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

The most powerful part of the Paint API is that it can read CSS custom properties (CSS Variables), which means the drawing behavior can be fully controlled from CSS:

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

The CSS side:

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

A common need is custom border styles, such as a zigzag edge:

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

A Worklet runs on a separate thread, so it can't directly access the DOM or use `requestAnimationFrame`. Animations need to be driven from the main thread by mutating a CSS variable to trigger a repaint:

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

Together with the main-thread animation:

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

| Feature | Paint API | Canvas |
|---------|-----------|--------|
| Thread | Worklet thread | Main thread |
| CSS integration | Built-in—can be used directly as a `background` | Requires manual setup |
| Responsive | Automatically follows the element's size | Requires manually listening for `resize` |
| DOM access | Not accessible | Accessible |
| Event handling | Not supported | Supported |

## Summary

- The CSS Paint API is the most mature module in the Houdini spec, and Chrome already supports it fully
- Register a painter via `registerPaint()` and draw with the Canvas 2D subset API
- `inputProperties` can read CSS custom properties for declarative control
- A Worklet runs on a separate thread, so it won't block the main thread
- Well suited to purely visual effects like background patterns, border decorations, and placeholders
- Animations need to mutate a CSS variable on the main thread to trigger a repaint
- You can fall back gracefully with css-paint-polyfill
