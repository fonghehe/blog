---
title: "Browser Rendering Pipeline: From Parsing to Painting"
date: 2019-11-07 09:32:47
tags:
  - Performance Optimization
readingTime: 4
description: "Understanding the browser's rendering pipeline is the foundation of front-end performance optimization. Whenever we change a CSS property, the browser runs through a series of complex processing steps before pixels reach the screen. Knowing what each step does helps us make smarter performance decisions."
wordCount: 582
---

Understanding the browser's rendering pipeline is the foundation of front-end performance optimization. Whenever we change a CSS property, the browser runs through a series of complex processing steps before pixels reach the screen. Knowing what each step does helps us make smarter performance decisions.

## Rendering Pipeline Overview

The process of turning HTML into on-screen pixels is known as the pixel pipeline. It mainly consists of the following steps:

```
JavaScript → Style → Layout → Paint → Composite
             计算样式   布局     绘制    合成
```

1. **JavaScript**: Execute JS, modifying the DOM or CSSOM
2. **Style**: Compute the final style of each element
3. **Layout**: Compute the geometry (position and size) of each element
4. **Paint**: Draw the element onto a layer (border, background, text, etc.)
5. **Composite**: Merge multiple layers into the final page

## 1. Parsing Phase

### HTML Parsing and the DOM Tree

The browser first parses HTML into a DOM (Document Object Model) tree:

```html
<html>
  <head>
    <title>页面标题</title>
  </head>
  <body>
    <div class="container">
      <h1>标题</h1>
      <p>段落</p>
    </div>
  </body>
</html>
```

The parsing process:

```
HTML 文本
    │
    ▼
HTML Parser
    │
    ▼
DOM Tree
    Document
      └── html
            ├── head
            │     └── title
            │           └── "页面标题"
            └── body
                  └── div.container
                        ├── h1 → "标题"
                        └── p → "段落"
```

### CSS Parsing and CSSOM

CSS files are parsed into a CSSOM (CSS Object Model) tree:

```css
.container {
  width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 24px;
  color: #333;
}
```

The CSSOM is also a tree structure, where each node holds style rules. CSS parsing is **render-blocking**, because the browser needs the complete style information before it can perform layout.

### The Critical Rendering Path

```
HTML ──→ DOM ──────┐
                   ├──→ Render Tree ──→ Layout ──→ Paint ──→ Composite
CSS  ──→ CSSOM ────┘
```

The DOM and CSSOM are merged into the render tree, which contains only the visible elements:

- The `<head>` element and its children are not in the render tree
- Elements with `display: none` are not in the render tree
- Elements with `visibility: hidden` are in the render tree (they still take up space)

## 2. Style Calculation

During the style calculation phase, the browser applies every CSS rule to the DOM nodes and computes the final style of each element:

```css
/* 多个规则可能匹配同一个元素 */
p { color: black; }
.text { color: blue; }
#main p { color: red; }
```

The browser computes CSS specificity to determine the final style. The result is a `ComputedStyle` object, which you can inspect via `window.getComputedStyle()`:

```js
const el = document.querySelector('.title');
const styles = window.getComputedStyle(el);
console.log(styles.color);       // "rgb(51, 51, 51)"
console.log(styles.fontSize);    // "24px"
console.log(styles.display);     // "block"
```

## 3. Layout

The layout phase computes the geometry of each element: its position and size. This process is also known as reflow:

```js
// 触发 Layout 的操作
element.style.width = '200px';  // 修改尺寸
element.style.left = '10px';    // 修改位置
window.innerWidth;              // 读取布局信息也会触发强制 Layout
element.offsetWidth;            // 同上
element.getBoundingClientRect();
```

### The Reach of Layout

Changing the layout of one element can affect others:

```
// 修改一个元素的宽度
<div class="parent" style="width: 400px">
  <div class="child" style="width: 50%">200px</div>
  <div class="sibling">剩余空间</div>
</div>

// 如果父元素宽度变为 600px
// child 从 200px 变为 300px
// sibling 也需要重新布局
```

## 4. Paint

The paint phase draws each element's visual effects onto layers. Painting happens per layer:

```js
// 以下 CSS 属性的修改只会触发 Paint，不会触发 Layout
element.style.color = 'red';          // 只绘制
element.style.backgroundColor = '#f00'; // 只绘制
element.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; // 只绘制
element.style.borderRadius = '8px';    // 只绘制
element.style.visibility = 'hidden';   // 只绘制
```

### Types of Painting

- **Paint records**: a list of drawing operations
- **Rasterization**: converts paint records into pixel bitmaps
- Rasterization usually runs on the GPU; modern browsers handle it with a compositor thread

## 5. Composite

Modern browsers split the page into multiple compositing layers, which are painted separately and then composited:

```
┌────────────────────────────┐
│  Layer 3: 弹窗              │
├────────────────────────────┤
│  Layer 2: 固定定位的导航栏   │
├────────────────────────────┤
│  Layer 1: 页面主体内容       │
├────────────────────────────┤
│  Layer 0: 背景              │
└────────────────────────────┘
```

### Conditions for Creating a New Layer

```css
/* 以下属性会创建新的合成层 */
.transform-layer {
  /* 1. 3D transforms */
  transform: translateZ(0);
  /* 或 will-change */
  will-change: transform;
}

.video-layer {
  /* 2. <video>、<canvas>、<iframe> 等元素 */
}

.fixed-layer {
  /* 3. position: fixed 在某些情况下 */
  position: fixed;
}

.composited-layer {
  /* 4. 有合成层后代且有 z-index */
  position: relative;
  z-index: 1;
}

.animated-layer {
  /* 5. 正在进行 CSS 动画的 transform 或 opacity */
  animation: slide 1s ease;
}

@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

## Impact Range of Different CSS Properties

Understanding which property changes trigger which pipeline stages is the key to performance optimization:

| Property changed | Stages triggered | Performance impact |
|------------------|------------------|--------------------|
| width, height, margin, padding | Layout → Paint → Composite | Slowest (full pipeline) |
| color, background, box-shadow | Paint → Composite | Faster (skips Layout) |
| transform, opacity | Composite | Fastest (compositing only) |

### Use `transform` Instead of `top`/`left`

```css
/* 差：每次都会触发布局 */
.moving-bad {
  position: absolute;
  transition: left 0.3s;
}
.moving-bad:hover {
  left: 100px;
}

/* 好：只触发合成 */
.moving-good {
  transition: transform 0.3s;
}
.moving-good:hover {
  transform: translateX(100px);
}
```

### Use `opacity` Instead of `visibility` for Animations

```css
/* opacity 只触发合成 */
.fade-in {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Forced Synchronous Layout

Alternating reads and writes of layout properties forces the browser into a synchronous layout, which severely hurts performance:

```js
// 差：读写交替，每次写都强制布局
function resizeAll() {
  const boxes = document.querySelectorAll('.box');
  boxes.forEach(box => {
    const width = box.offsetWidth;     // 读（强制布局）
    box.style.width = (width + 10) + 'px'; // 写（使布局失效）
  });
}

// 好：先读后写
function resizeAllOptimized() {
  const boxes = document.querySelectorAll('.box');
  // 先读
  const widths = Array.from(boxes).map(box => box.offsetWidth);
  // 再写
  boxes.forEach((box, i) => {
    box.style.width = (widths[i] + 10) + 'px';
  });
}
```

## Layout Thrashing

Layout thrashing is a performance problem caused by repeatedly triggering layout within the same frame:

```js
// 差：在循环中读写布局属性
function layoutThrashing() {
  const items = document.querySelectorAll('.item');
  items.forEach(item => {
    // 每次读取 offsetHeight 都会触发同步布局
    const height = item.offsetHeight;
    item.style.height = (height * 1.1) + 'px';
  });
}

// 好：使用 requestAnimationFrame 批量处理
function optimized() {
  const items = document.querySelectorAll('.item');
  const heights = [];

  items.forEach(item => heights.push(item.offsetHeight));

  requestAnimationFrame(() => {
    items.forEach((item, i) => {
      item.style.height = (heights[i] * 1.1) + 'px';
    });
  });
}
```

## Measuring with the Performance API

```js
// 测量渲染性能
function measureRender(label, fn) {
  performance.mark(`${label}-start`);
  fn();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measures = performance.getEntriesByName(label);
      console.log(`${label}: ${measures[0].duration.toFixed(2)}ms`);
    });
  });
}

measureRender('列表渲染', () => {
  renderList(1000);
});
```

## Summary

- Rendering pipeline: JavaScript → Style → Layout → Paint → Composite
- Changing geometric properties like `width` and `height` triggers the full pipeline (slowest)
- Changing properties like `color` and `background` triggers only Paint (faster)
- Changing `transform` and `opacity` triggers only Composite (fastest)
- Forced synchronous layout (alternating reads and writes) severely hurts performance
- Use `will-change` to hint the browser to create compositing layers ahead of time
- Batch DOM updates with `requestAnimationFrame`
- Use `transform` instead of `top`/`left` for animations
