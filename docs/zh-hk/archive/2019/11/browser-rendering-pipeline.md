---
title: "瀏覽器渲染流水線從解析到繪製"
date: 2019-11-07 09:32:47
tags:
  - 性能優化
readingTime: 5
description: "理解瀏覽器的渲染流水線是前端性能優化的基礎。當我們修改 CSS 屬性時，瀏覽器會經過一系列複雜的處理步驟才能將像素顯示到屏幕上。瞭解每一步做了什麼，可以幫助我們做出更明智的性能決策。"
wordCount: 914
---

理解瀏覽器的渲染流水線是前端性能優化的基礎。當我們修改 CSS 屬性時，瀏覽器會經過一系列複雜的處理步驟才能將像素顯示到屏幕上。瞭解每一步做了什麼，可以幫助我們做出更明智的性能決策。

## 渲染流水線總覽

瀏覽器將 HTML 轉換為屏幕上像素的過程被稱為像素流水線（Pixel Pipeline），主要包含以下步驟：

```
JavaScript → Style → Layout → Paint → Composite
             計算樣式   佈局     繪製    合成
```

1. **JavaScript**：執行 JS，修改 DOM 或 CSSOM
2. **Style（樣式計算）**：計算每個元素的最終樣式
3. **Layout（佈局）**：計算元素的幾何信息（位置和大小）
4. **Paint（繪製）**：將元素繪製到圖層上（邊框、背景、文字等）
5. **Composite（合成）**：將多個圖層合成為最終的頁面

## 1. 解析階段

### HTML 解析與 DOM 樹

瀏覽器首先將 HTML 解析為 DOM（Document Object Model）樹：

```html
<html>
  <head>
    <title>頁面標題</title>
  </head>
  <body>
    <div class="container">
      <h1>標題</h1>
      <p>段落</p>
    </div>
  </body>
</html>
```

解析過程：

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
            │           └── "頁面標題"
            └── body
                  └── div.container
                        ├── h1 → "標題"
                        └── p → "段落"
```

### CSS 解析與 CSSOM

CSS 文件被解析為 CSSOM（CSS Object Model）樹：

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

CSSOM 也是一個樹形結構，每個節點包含樣式規則。CSS 的解析是**渲染阻塞**的，因為瀏覽器需要完整的樣式信息才能進行佈局。

### 關鍵渲染路徑

```
HTML ──→ DOM ──────┐
                   ├──→ Render Tree ──→ Layout ──→ Paint ──→ Composite
CSS  ──→ CSSOM ────┘
```

DOM 和 CSSOM 合併為渲染樹（Render Tree），只包含可見元素：

- `<head>` 及其子元素不在渲染樹中
- `display: none` 的元素不在渲染樹中
- `visibility: hidden` 的元素在渲染樹中（佔用空間）

## 2. Style 計算

樣式計算階段，瀏覽器將所有 CSS 規則應用到 DOM 節點上，計算出每個元素的最終樣式：

```css
/* 多個規則可能匹配同一個元素 */
p { color: black; }
.text { color: blue; }
#main p { color: red; }
```

瀏覽器會計算 CSS 優先級（Specificity），確定最終樣式。這個過程的結果是一個 `ComputedStyle` 對象，可以通過 `window.getComputedStyle()` 查看：

```js
const el = document.querySelector('.title');
const styles = window.getComputedStyle(el);
console.log(styles.color);       // "rgb(51, 51, 51)"
console.log(styles.fontSize);    // "24px"
console.log(styles.display);     // "block"
```

## 3. Layout（佈局）

佈局階段計算每個元素的幾何信息：位置、大小。這個過程也叫做 Reflow（迴流）：

```js
// 觸發 Layout 的操作
element.style.width = '200px';  // 修改尺寸
element.style.left = '10px';    // 修改位置
window.innerWidth;              // 讀取佈局信息也會觸發強制 Layout
element.offsetWidth;            // 同上
element.getBoundingClientRect();
```

### 佈局的影響範圍

修改一個元素的佈局可能影響其他元素：

```
// 修改一個元素的寬度
<div class="parent" style="width: 400px">
  <div class="child" style="width: 50%">200px</div>
  <div class="sibling">剩餘空間</div>
</div>

// 如果父元素寬度變為 600px
// child 從 200px 變為 300px
// sibling 也需要重新佈局
```

## 4. Paint（繪製）

繪製階段將元素的視覺效果繪製到圖層上。繪製是按圖層（Layer）進行的：

```js
// 以下 CSS 屬性的修改只會觸發 Paint，不會觸發 Layout
element.style.color = 'red';          // 只繪製
element.style.backgroundColor = '#f00'; // 只繪製
element.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; // 只繪製
element.style.borderRadius = '8px';    // 只繪製
element.style.visibility = 'hidden';   // 只繪製
```

### 繪製的類型

- **繪製記錄（Paint Records）**：記錄了繪製操作的列表
- **光柵化（Rasterization）**：將繪製記錄轉換為像素位圖
- 光柵化通常在 GPU 上進行，現代瀏覽器使用合成器線程來處理

## 5. Composite（合成）

現代瀏覽器將頁面分為多個圖層（Compositing Layers），單獨繪製後再合成：

```
┌────────────────────────────┐
│  Layer 3: 彈窗              │
├────────────────────────────┤
│  Layer 2: 固定定位的導航欄   │
├────────────────────────────┤
│  Layer 1: 頁面主體內容       │
├────────────────────────────┤
│  Layer 0: 背景              │
└────────────────────────────┘
```

### 創建新圖層的條件

```css
/* 以下屬性會創建新的合成層 */
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
  /* 3. position: fixed 在某些情況下 */
  position: fixed;
}

.composited-layer {
  /* 4. 有合成層後代且有 z-index */
  position: relative;
  z-index: 1;
}

.animated-layer {
  /* 5. 正在進行 CSS 動畫的 transform 或 opacity */
  animation: slide 1s ease;
}

@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

## 不同 CSS 屬性的影響範圍

理解哪些屬性變化會觸發流水線的哪些步驟，是性能優化的關鍵：

| 修改的屬性 | 觸發的階段 | 性能影響 |
|
-----------|-----------|---------|
| width, height, margin, padding | Layout → Paint → Composite | 最慢（全流水線） |
| color, background, box-shadow | Paint → Composite | 較快（跳過 Layout） |
| transform, opacity | Composite | 最快（只合成） |

### 使用 transform 替代 top/left

```css
/* 差：每次都會觸發佈局 */
.moving-bad {
  position: absolute;
  transition: left 0.3s;
}
.moving-bad:hover {
  left: 100px;
}

/* 好：只觸發合成 */
.moving-good {
  transition: transform 0.3s;
}
.moving-good:hover {
  transform: translateX(100px);
}
```

### 使用 opacity 替代 visibility 的動畫

```css
/* opacity 只觸發合成 */
.fade-in {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## 強制同步佈局（Forced Synchronous Layout）

交替讀寫佈局屬性會導致瀏覽器強制同步佈局，嚴重影響性能：

```js
// 差：讀寫交替，每次寫都強制佈局
function resizeAll() {
  const boxes = document.querySelectorAll('.box');
  boxes.forEach(box => {
    const width = box.offsetWidth;     // 讀（強制佈局）
    box.style.width = (width + 10) + 'px'; // 寫（使佈局失效）
  });
}

// 好：先讀後寫
function resizeAllOptimized() {
  const boxes = document.querySelectorAll('.box');
  // 先讀
  const widths = Array.from(boxes).map(box => box.offsetWidth);
  // 再寫
  boxes.forEach((box, i) => {
    box.style.width = (widths[i] + 10) + 'px';
  });
}
```

## 佈局抖動（Layout Thrashing）

佈局抖動是指在同一幀內反覆觸發佈局的性能問題：

```js
// 差：在循環中讀寫佈局屬性
function layoutThrashing() {
  const items = document.querySelectorAll('.item');
  items.forEach(item => {
    // 每次讀取 offsetHeight 都會觸發同步佈局
    const height = item.offsetHeight;
    item.style.height = (height * 1.1) + 'px';
  });
}

// 好：使用 requestAnimationFrame 批量處理
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

## 使用 Performance API 測量

```js
// 測量渲染性能
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

## 小結

- 渲染流水線：JavaScript → Style → Layout → Paint → Composite
- 修改 `width`、`height` 等幾何屬性觸發全流水線（最慢）
- 修改 `color`、`background` 等屬性只觸發 Paint（較快）
- 修改 `transform`、`opacity` 只觸發 Composite（最快）
- 強制同步佈局（讀寫交替）會嚴重影響性能
- 使用 `will-change` 提示瀏覽器提前創建合成層
- 使用 `requestAnimationFrame` 批量處理 DOM 更新
- 用 `transform` 替代 `top/left` 做動畫
