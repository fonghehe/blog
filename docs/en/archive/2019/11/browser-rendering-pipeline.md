---
title: "Browser Rendering Pipeline: From Parsing to Painting"
date: 2019-11-07 09:32:47
tags:
  - Performance Optimization
readingTime: 5
description: "理解浏览器的渲染流水线是前端性能优化的基础。当我们修改 CSS 属性时，浏览器会经过一系列复杂的处理步骤才能将像素显示到屏幕上。了解每一步做了什么，可以帮助我们做出更明智的性能决策。"
---

理解浏览器的渲染流水线是前端性能优化的基础。当我们修改 CSS 属性时，浏览器会经过一系列复杂的处理步骤才能将像素显示到屏幕上。了解每一步做了什么，可以帮助我们做出更明智的性能决策。

## Rendering Pipeline Overview

浏览器将 HTML 转换为屏幕上像素的过程被称为像素流水线（Pixel Pipeline），主要包含以下步骤：

```
JavaScript → Style → Layout → Paint → Composite
             计算样式   布局     绘制    合成
```

1. **JavaScript**：执行 JS，修改 DOM 或 CSSOM
2. **Style（样式计算）**：计算每个元素的最终样式
3. **Layout（布局）**：计算元素的几何信息（位置和大小）
4. **Paint（绘制）**：将元素绘制到图层上（边框、背景、文字等）
5. **Composite（合成）**：将多个图层合成为最终的页面

## 1. Parsing Phase

### HTML 解析与 DOM 树

浏览器首先将 HTML 解析为 DOM（Document Object Model）树：

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

解析过程：

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

### CSS 解析与 CSSOM

CSS 文件被解析为 CSSOM（CSS Object Model）树：

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

CSSOM 也是一个树形结构，每个节点包含样式规则。CSS 的解析是**渲染阻塞**的，因为浏览器需要完整的样式信息才能进行布局。

### 关键渲染路径

```
HTML ──→ DOM ──────┐
                   ├──→ Render Tree ──→ Layout ──→ Paint ──→ Composite
CSS  ──→ CSSOM ────┘
```

DOM 和 CSSOM 合并为渲染树（Render Tree），只包含可见元素：

- `<head>` 及其子元素不在渲染树中
- `display: none` 的元素不在渲染树中
- `visibility: hidden` 的元素在渲染树中（占用空间）

## 2. Style Calculation

样式计算阶段，浏览器将所有 CSS 规则应用到 DOM 节点上，计算出每个元素的最终样式：

```css
/* 多个规则可能匹配同一个元素 */
p { color: black; }
.text { color: blue; }
#main p { color: red; }
```

浏览器会计算 CSS 优先级（Specificity），确定最终样式。这个过程的结果是一个 `ComputedStyle` 对象，可以通过 `window.getComputedStyle()` 查看：

```js
const el = document.querySelector('.title');
const styles = window.getComputedStyle(el);
console.log(styles.color);       // "rgb(51, 51, 51)"
console.log(styles.fontSize);    // "24px"
console.log(styles.display);     // "block"
```

## 3. Layout

布局阶段计算每个元素的几何信息：位置、大小。这个过程也叫做 Reflow（回流）：

```js
// 触发 Layout 的操作
element.style.width = '200px';  // 修改尺寸
element.style.left = '10px';    // 修改位置
window.innerWidth;              // 读取布局信息也会触发强制 Layout
element.offsetWidth;            // 同上
element.getBoundingClientRect();
```

### 布局的影响范围

修改一个元素的布局可能影响其他元素：

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

绘制阶段将元素的视觉效果绘制到图层上。绘制是按图层（Layer）进行的：

```js
// 以下 CSS 属性的修改只会触发 Paint，不会触发 Layout
element.style.color = 'red';          // 只绘制
element.style.backgroundColor = '#f00'; // 只绘制
element.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; // 只绘制
element.style.borderRadius = '8px';    // 只绘制
element.style.visibility = 'hidden';   // 只绘制
```

### 绘制的类型

- **绘制记录（Paint Records）**：记录了绘制操作的列表
- **光栅化（Rasterization）**：将绘制记录转换为像素位图
- 光栅化通常在 GPU 上进行，现代浏览器使用合成器线程来处理

## 5. Composite

现代浏览器将页面分为多个图层（Compositing Layers），单独绘制后再合成：

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

### 创建新图层的条件

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

理解哪些属性变化会触发流水线的哪些步骤，是性能优化的关键：

| 修改的属性 | 触发的阶段 | 性能影响 |
|-----------|-----------|---------|
| width, height, margin, padding | Layout → Paint → Composite | 最慢（全流水线） |
| color, background, box-shadow | Paint → Composite | 较快（跳过 Layout） |
| transform, opacity | Composite | 最快（只合成） |

### 使用 transform 替代 top/left

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

### 使用 opacity 替代 visibility 的动画

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

交替读写布局属性会导致浏览器强制同步布局，严重影响性能：

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

## 布局抖动（Layout Thrashing）

布局抖动是指在同一帧内反复触发布局的性能问题：

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

- 渲染流水线：JavaScript → Style → Layout → Paint → Composite
- 修改 `width`、`height` 等几何属性触发全流水线（最慢）
- 修改 `color`、`background` 等属性只触发 Paint（较快）
- 修改 `transform`、`opacity` 只触发 Composite（最快）
- 强制同步布局（读写交替）会严重影响性能
- 使用 `will-change` 提示浏览器提前创建合成层
- 使用 `requestAnimationFrame` 批量处理 DOM 更新
- 用 `transform` 替代 `top/left` 做动画
