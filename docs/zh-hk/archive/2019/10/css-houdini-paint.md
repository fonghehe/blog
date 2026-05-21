---
title: "CSS Houdini Paint API 探索"
date: 2019-10-03 15:32:59
tags:
  - CSS
readingTime: 4
description: "CSS Houdini 是 W3C 提出的一組底層 CSS API，它讓開發者可以直接接入 CSS 渲染引擎的各個階段。其中 Paint API 是目前瀏覽器支持度最好的一個，它允許我們用 JavaScript 繪製自定義的 CSS 圖案，替代傳統的背景圖方案。"
wordCount: 685
---

CSS Houdini 是 W3C 提出的一組底層 CSS API，它讓開發者可以直接接入 CSS 渲染引擎的各個階段。其中 Paint API 是目前瀏覽器支持度最好的一個，它允許我們用 JavaScript 繪製自定義的 CSS 圖案，替代傳統的背景圖方案。

## 什麼是 CSS Paint API

傳統方式下，如果我們想實現一個複雜的背景效果（比如漸變網格、波浪線、動態斑點），要麼用 CSS 漸變拼湊，要麼用圖片，要麼用 SVG。CSS Paint API 提供了第四種方案：用 JavaScript 編寫繪製邏輯，然後像 CSS 函數一樣直接調用。

```css
/* 傳統方式 */
.box {
  background: url('dots.png') repeat;
}

/* Paint API 方式 */
.box {
  background: paint(dots);
}
```

核心概念包括：

- **Worklet**：運行在獨立線程中的輕量級 JS 模塊
- **registerPaint()**：註冊一個繪製處理器
- **paint()**：實際的繪製回調函數

## 瀏覽器支持與檢測

截至目前，Chrome 65+ 已經完整支持 Paint API，Edge 基於 Chromium 也支持，Firefox 和 Safari 暫未默認開啓。

```js
// 檢測瀏覽器支持
if ('paintWorklet' in CSS) {
  console.log('CSS Paint API 可用');
} else {
  console.log('需要 polyfill 或降級方案');
}
```

可以使用 [css-paint-polyfill](https://github.com/GoogleChromeLabs/css-paint-polyfill) 做兼容：

```html
<script src="https://unpkg.com/css-paint-polyfill"></script>
```

## 註冊第一個 Paint Worklet

創建一個獨立的 JS 文件作為 Worklet，在其中使用 `registerPaint` 註冊繪製器。Worklet 中可以使用的繪圖 API 是 Canvas 2D API 的一個子集：

```js
// worklets/dots.js
class DotsPainter {
  // 聲明此繪製器依賴的 CSS 屬性
  static get inputProperties() {
    return [
      '--dot-color',
      '--dot-size',
      '--dot-spacing'
    ];
  }

  // 繪製回調
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

在頁面中加載 Worklet：

```js
// 主線程中註冊
if ('paintWorklet' in CSS) {
  CSS.paintWorklet.addModule('/worklets/dots.js');
}
```

然後就可以在 CSS 中使用了：

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

## 使用 inputProperties 響應 CSS 變量

Paint API 最強大的地方在於它可以讀取 CSS 自定義屬性（CSS Variables），這意味着繪製行為可以完全由 CSS 控制：

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

## 實戰：自定義邊框繪製器

一個常見的需求是自定義邊框樣式，比如鋸齒邊框：

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

    // 頂部鋸齒
    for (let x = 0; x < size.width; x += zigSize * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + zigSize, zigSize);
      ctx.lineTo(x + zigSize * 2, 0);
      ctx.fill();
    }

    // 底部鋸齒
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

## 實現動畫效果

Worklet 運行在獨立線程，不能直接訪問 DOM 或使用 `requestAnimationFrame`。動畫需要在主線程中通過修改 CSS 變量來觸發重繪：

```js
// 主線程代碼
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

## 實戰：Skeleton 加載佔位圖

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

    // 閃光掃過效果
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

配合主線程動畫：

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

## 與 Canvas 的對比

| 特性 | Paint API | Canvas |
|
------|-----------|--------|
| 運行線程 | Worklet 線程 | 主線程 |
| 與 CSS 集成 | 天然集成，可直接用作 background | 需要手動設置 |
| 響應式 | 自動隨元素尺寸變化 | 需要手動監聽 resize |
| DOM 訪問 | 不可訪問 | 可訪問 |
| 事件處理 | 不支持 | 支持 |

## 小結

- CSS Paint API 是 Houdini 規範中最成熟的模塊，Chrome 已完整支持
- 通過 `registerPaint()` 註冊繪製器，用 Canvas 2D 子集 API 繪製
- `inputProperties` 可以讀取 CSS 自定義屬性，實現聲明式控制
- Worklet 運行在獨立線程，不會阻塞主線程
- 適合用於背景圖案、邊框裝飾、佔位圖等純視覺效果
- 動畫需要在主線程修改 CSS 變量來觸發重繪
- 可以通過 css-paint-polyfill 做降級兼容
