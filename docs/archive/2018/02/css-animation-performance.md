---
title: "CSS 动画性能优化：从原理到实践"
date: 2019-06-06 16:37:34
tags:
  - CSS
---

前端动画做多了会发现，不是写不出动画，而是动画一多就卡。尤其在移动端，60fps 的流畅动画是用户体验的底线。这篇文章从浏览器渲染原理出发，搞清楚 CSS 动画到底卡在哪里，以及怎么优化。

## 浏览器渲染管线

要优化动画性能，首先得理解浏览器渲染一帧的流程：

```
JavaScript → Style → Layout → Paint → Composite
                                      (合成)
                  ↑
              计算几何       ↑
              位置和大小    光栅化像素
```

每个阶段做的事情：
- **Style**：计算元素最终的 CSS 样式
- **Layout**（回流）：计算元素的几何信息——位置、宽高
- **Paint**（重绘）：填充像素——颜色、边框、阴影、文字等
- **Composite**（合成）：把多个图层合并成最终页面

关键认知：**越靠后的阶段，修改属性的性能开销越小**。在 Composite 阶段处理的属性不会触发 Layout 和 Paint。

## 哪些 CSS 属性会触发哪些阶段

这是优化的核心知识：

```css
/* 仅触发 Composite（最优） */
.animated-gpu {
  /*
   * transform 和 opacity 是两个最安全的动画属性。
   * 它们可以被 GPU 直接处理，不触发布局和重绘。
   * transform 包括：translate、rotate、scale、skew
   */
  transform: translateX(100px);
  transform: rotate(45deg);
  transform: scale(1.5);
  opacity: 0.5;
}

/* 触发 Paint + Composite（中等开销） */
.animated-paint {
  /*
   * 这些属性不改变元素的几何信息（不需要回流），
   * 但需要重新绘制像素。
   */
  color: red;
  background: blue;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: transparent;
  outline: none;
}

/* 触发 Layout + Paint + Composite（开销最大，动画中要避免） */
.animated-layout {
  /*
   * 这些属性改变元素的几何信息，
   * 导致浏览器重新计算布局（回流），
   * 然后连带触发重绘和合成。
   * 一个元素回流可能触发祖先和后代的连锁回流。
   */
  width: 200px;
  height: 100px;
  margin: 10px;
  padding: 20px;
  top: 50px;
  left: 50px;
  font-size: 16px;
}
```

所以核心原则就一句话：**动画尽量只用 `transform` 和 `opacity`**。

## 用 transform 替代 layout 属性

实际开发中最常见的错误就是用 `top/left` 做位移动画：

```css
/* ❌ 差：用 left/top 做位移动画，每一帧都触发 Layout */
.mover-bad {
  position: absolute;
  left: 0;
  animation: moveBad 2s ease-in-out infinite alternate;
}

@keyframes moveBad {
  from { left: 0; }
  to   { left: 300px; }
}

/* ✅ 好：用 transform 做位移动画，只触发 Composite */
.mover-good {
  position: absolute;
  left: 0;
  /* 开启硬件加速的提示 */
  will-change: transform;
  animation: moveGood 2s ease-in-out infinite alternate;
}

@keyframes moveGood {
  from { transform: translateX(0); }
  to   { transform: translateX(300px); }
}
```

同理，改变大小也用 `scale` 而不是 `width/height`：

```css
/* ❌ 差：改变 width/height 触发 Layout */
.expand-bad {
  width: 100px;
  height: 100px;
  animation: expandBad 0.3s ease forwards;
}

@keyframes expandBad {
  to {
    width: 300px;
    height: 300px;
  }
}

/* ✅ 好：用 scale 避免回流 */
.expand-good {
  width: 300px;
  height: 300px;
  transform: scale(0.33);
  transform-origin: top left;
  animation: expandGood 0.3s ease forwards;
}

@keyframes expandGood {
  to {
    transform: scale(1);
  }
}
```

## will-change 的正确使用

`will-change` 是给浏览器的一个优化提示，告诉浏览器「这个元素即将要变化」，让浏览器提前创建独立的合成层。

```css
/* ✅ 正确用法：提前声明即将变化的属性 */
.optimized-element {
  /*
   * 告诉浏览器这个元素的 transform 和 opacity 会变化，
   * 浏览器会提前把它提升到独立的合成层（GPU 纹理）。
   * 这样动画开始时就不用再做图层提升了。
   */
  will-change: transform, opacity;
}

/* ❌ 错误用法一：给太多元素加 will-change */
.all-elements > * {
  /*
   * 不要这样做！每个独立的合成层都会占用 GPU 内存。
   * 给几百个元素都加 will-change 会导致显存不足，
   * 性能反而更差。
   */
  will-change: transform;
}

/* ❌ 错误用法二：把 will-change 写在永远在线的样式里 */
.always-will-change {
  /*
   * 如果元素的动画已经结束，应该移除 will-change，
   * 否则它一直占用 GPU 内存。
   * 推荐用 JS 动态添加/移除，或者配合 :hover 使用。
   */
  will-change: transform;
}
```

推荐的 JS 动态管理方式：

```javascript
// 动画开始前添加 will-change
element.style.willChange = 'transform, opacity';

// 动画结束后移除
element.addEventListener('transitionend', function handler() {
  element.style.willChange = 'auto';
  element.removeEventListener('transitionend', handler);
});
```

```css
/* 也可以只在交互态时添加 */
.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-card:hover {
  /* 只在 hover 时才需要 will-change */
  will-change: transform;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

## 合成层（Composite Layer）详解

浏览器会把页面分成多个合成层，每一层独立光栅化，然后由 GPU 合成最终画面。以下情况会创建新的合成层：

```css
/* 这些 CSS 声明都会创建独立的合成层 */

/* 1. 3D transform */
.layer-3d {
  transform: translateZ(0);
  /* 或 */
  transform: translate3d(0, 0, 0);
}

/* 2. will-change 值包含 transform/opacity */
.layer-will-change {
  will-change: transform;
}

/* 3. video / canvas / iframe 等元素 */

/* 4. position: fixed（某些浏览器） */
.layer-fixed {
  position: fixed;
}

/* 5. 有 transform 或 opacity 动画的元素 */
.layer-animated {
  animation: fadeIn 1s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* 6. 有 backface-visibility: hidden 的元素 */
.layer-backface {
  backface-visibility: hidden;
}
```

「CSS 黑魔法」`transform: translateZ(0)` 就是利用这个原理强制创建合成层。但不要滥用：

```css
/* ⚠️ 用 translateZ(0) 强制 GPU 加速——慎用 */
.gpu-hack {
  /*
   * 这确实能强制创建合成层，让子元素的动画在 GPU 上运行。
   * 但如果页面中大量使用，会消耗大量显存。
   * 现代浏览器已经足够智能，大多数情况下不需要手动 hack。
   * 仅在确实遇到性能问题且测试有效时使用。
   */
  transform: translateZ(0);
}
```

## requestAnimationFrame vs CSS 动画

什么时候用 CSS 动画，什么时候用 JS（`requestAnimationFrame`）控制动画？

```css
/* CSS 动画/过渡：适合简单、状态驱动的动画 */
.css-transition-example {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.css-animation-example {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

```javascript
// requestAnimationFrame：适合需要精确控制的动画
// 例如：跟手拖拽、粒子效果、物理引擎驱动的动画

function animateWithRAF(element) {
  let startTime = null;
  const duration = 1000; // 1秒

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;

    if (progress < 1) {
      // 计算当前位置：ease-out 缓动函数
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = eased * 300;

      // 每帧只修改 transform，确保走 Composite 路径
      element.style.transform = `translateX(${x}px)`;
      element.style.opacity = 0.5 + progress * 0.5;

      // 请求下一帧
      requestAnimationFrame(step);
    } else {
      // 动画结束
      element.style.transform = 'translateX(300px)';
      element.style.opacity = '1';
    }
  }

  requestAnimationFrame(step);
}
```

选择标准：
- **CSS 动画**：简单的过渡、悬停效果、循环动画——浏览器可以做很多优化
- **requestAnimationFrame**：需要与 JS 逻辑交互、物理模拟、大量元素同步动画

## 用 DevTools 分析动画性能

理论讲完了，来看实际怎么排查性能问题。Chrome DevTools 提供了强大的分析工具：

```bash
# 打开 Chrome DevTools 的方式
# 1. F12 或 Cmd+Option+I (Mac)
# 2. 切换到 Performance 面板
# 3. 勾选 Screenshots 和 Web Vitals
# 4. 点击录制，在页面上触发动画
# 5. 停止录制，分析火焰图
```

关键指标怎么看：

```
Performance 面板中需要关注的指标：
├── FPS（帧率）
│   ├── 绿色条越高越好，目标是稳定的 60fps
│   ├── 红色区域 = 掉帧，用户体验到卡顿
│   └── 帧率低于 30fps 肉眼就能感受到明显卡顿
│
├── Frames 行
│   ├── 每个色块代表一帧
│   ├── 绿色 = 正常
│   ├── 黄色 = 有长任务但没掉帧
│   └── 红色 = 掉帧
│
├── Main 线程
│   ├── 查看哪些函数占用了主线程时间
│   ├── 紫色 = Style/Layout
│   ├── 绿色 = Paint
│   └── 找到耗时最长的任务进行优化
│
└── Rendering 面板（More tools → Rendering）
    ├── Paint flashing：高亮重绘区域
    ├── Layer borders：显示合成层边界
    ├── FPS meter：实时帧率
    └── Scrolling performance issues：滚动性能提示
```

打开 Paint flashing 的方式：

```
DevTools → 更多工具(More tools) → 渲染(Rendering)
→ 勾选 "Paint flashing"

效果：每次发生重绘的区域会被绿色高亮
目标：动画过程中，绿色闪烁区域应该尽可能小
如果整个页面都在闪绿光，说明重绘范围太大了
```

## 减少重绘区域

有时候虽然用了 `transform`，性能还是不理想，问题可能出在重绘区域太大：

```css
/* 场景：一个固定在底部的操作栏 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  /*
   * 问题：如果底栏有 box-shadow、border-radius 等需要重绘的属性，
   * 当上方内容滚动时，浏览器可能需要重新绘制这个底栏所在的区域。
   * 如果底栏层级（z-index）很高，上方内容被遮挡的部分也算在内。
   */
  z-index: 100;
  background: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

/* ✅ 优化：用 isolation 创建独立的合成层 */
.bottom-bar-optimized {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 100;
  background: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);

  /*
   * 将底栏提升为独立的合成层，
   * 这样它不会影响到其他区域的重绘。
   */
  will-change: transform;
  transform: translateZ(0);
}
```

另一个常见的优化场景——滚动列表中的动画元素：

```css
/* 场景：列表项 hover 时有放大效果 */
.list-item {
  /*
   * 问题：如果列表很长（几百项），
   * hover 放大可能触发大面积重绘，
   * 因为放大的元素可能会覆盖相邻元素。
   */
  transition: transform 0.2s ease;
}

.list-item:hover {
  transform: scale(1.05);
}

/* ✅ 优化方案：给每个 item 创建独立的层 */
.optimized-list-item {
  /*
   * 使用 contain 限制重绘范围。
   * layout：元素内部的布局变化不影响外部
   * paint：元素的绘制不会溢出边界
   */
  contain: layout paint;
  transition: transform 0.2s ease;
  /* 提升到独立合成层 */
  will-change: transform;
}

.optimized-list-item:hover {
  transform: scale(1.05);
  /* 放大时加阴影，使用 box-shadow 而不是 outline */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

## CSS contain 属性

`contain` 是一个容易被忽略但非常有用的优化属性：

```css
/*
 * contain 告诉浏览器：这个元素内部的变化
 * 不会影响外部的布局和绘制。
 * 浏览器可以据此缩小回流和重绘的范围。
 */

.strict-card {
  /*
   * contain: strict 等同于 contain: size layout style paint
   * 最严格的隔离，但要确保元素大小不依赖内容
   */
  contain: strict;
  width: 300px;
  height: 200px;
}

.content-card {
  /*
   * 常用组合：layout paint
   * - layout：内部回流不影响外部
   * - paint：内部绘制不溢出边界
   * 不用 size，因为大多数元素的尺寸依赖内容
   */
  contain: layout paint;
}

.virtual-list-item {
  /*
   * 虚拟列表场景特别有用：
   * 告诉浏览器每个列表项是独立的，
   * 一个列表项的变化不会导致其他列表项回流/重绘
   */
  contain: layout paint style;
}
```

## 实战：优化一个弹窗动画

最后用一个综合示例把所有知识点串起来：

```css
/*
 * 场景：一个从底部滑入的弹窗
 * 要求：60fps 流畅动画，移动端体验良好
 */

/* 弹窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;

  /* ✅ 仅用 opacity 做淡入淡出 */
  opacity: 0;
  visibility: hidden;
  /* 使用 GPU 加速的过渡 */
  transition: opacity 0.3s ease, visibility 0.3s ease;

  /* 提示浏览器准备变化 */
  will-change: opacity;
}

.modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* 弹窗主体 */
.modal-content {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  z-index: 1001;
  /* 提前设置最终尺寸，避免动画中回流 */
  height: 70vh;

  /* ✅ 仅用 transform 做位移动画 */
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);

  /* 提前告知浏览器 */
  will-change: transform;

  /* ✅ 限制重绘范围 */
  contain: layout paint;
}

.modal-content.active {
  transform: translateY(0);
}

/* 动画结束后移除 will-change */
/* 这一步通过 JS 的 transitionend 事件实现 */
```

```javascript
// 动画结束后移除 will-change，释放 GPU 内存
const overlay = document.querySelector('.modal-overlay');
const content = document.querySelector('.modal-content');

function openModal() {
  content.style.willChange = 'transform';
  overlay.style.willChange = 'opacity';
  // 强制回流确保 will-change 生效（读取 offsetHeight 即可触发）
  void content.offsetHeight;
  overlay.classList.add('active');
  content.classList.add('active');
}

function closeModal() {
  overlay.classList.remove('active');
  content.classList.remove('active');
}

// 监听 transitionend 事件，动画完成后清理
content.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'transform' && !content.classList.contains('active')) {
    // 弹窗关闭动画结束，移除 will-change
    content.style.willChange = 'auto';
    overlay.style.willChange = 'auto';
  }
});
```

## 小结

- 动画属性选择的核心原则：优先使用 `transform` 和 `opacity`，它们只触发 Composite，跳过 Layout 和 Paint
- `will-change` 是优化提示而非万能药——只在动画即将发生时添加，动画结束后移除，避免滥用导致显存不足
- `contain: layout paint` 可以有效缩小回流和重绘的影响范围
- CSS 动画适合简单的状态驱动动画，`requestAnimationFrame` 适合需要精确控制的复杂动画
- 善用 DevTools 的 Performance 面板和 Paint flashing 来定位真正的性能瓶颈，不要凭感觉优化
