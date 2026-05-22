---
title: "CSS 動畫效能最佳化 2019：will-change 與復合圖層進階"
date: 2019-06-06 16:37:34
tags:
  - CSS
readingTime: 6
description: "前端動畫做多了會發現，不是寫不出動畫，而是動畫一多就卡。尤其在移動端，60fps 的流暢動畫是使用者體驗的底線。這篇文章從瀏覽器渲染原理出發，搞清楚 CSS 動畫到底卡在哪裡，以及怎麼最佳化。"
wordCount: 838
---

前端動畫做多了會發現，不是寫不出動畫，而是動畫一多就卡。尤其在移動端，60fps 的流暢動畫是使用者體驗的底線。這篇文章從瀏覽器渲染原理出發，搞清楚 CSS 動畫到底卡在哪裡，以及怎麼最佳化。

## 瀏覽器渲染管線

要最佳化動畫效能，首先得理解瀏覽器渲染一幀的流程：

```
JavaScript → Style → Layout → Paint → Composite
                                      (合成)
                  ↑
              計算幾何       ↑
              位置和大小    光柵化畫素
```

每個階段做的事情：
- **Style**：計算元素最終的 CSS 樣式
- **Layout**（迴流）：計算元素的幾何資訊——位置、寬高
- **Paint**（重繪）：填充畫素——顏色、邊框、陰影、文字等
- **Composite**（合成）：把多個圖層合併成最終頁面

關鍵認知：**越靠後的階段，修改屬性的效能開銷越小**。在 Composite 階段處理的屬性不會觸發 Layout 和 Paint。

## 哪些 CSS 屬性會觸發哪些階段

這是最佳化的核心知識：

```css
/* 僅觸發 Composite（最優） */
.animated-gpu {
  /*
   * transform 和 opacity 是兩個最安全的動畫屬性。
   * 它們可以被 GPU 直接處理，不觸發佈局和重繪。
   * transform 包括：translate、rotate、scale、skew
   */
  transform: translateX(100px);
  transform: rotate(45deg);
  transform: scale(1.5);
  opacity: 0.5;
}

/* 觸發 Paint + Composite（中等開銷） */
.animated-paint {
  /*
   * 這些屬性不改變元素的幾何資訊（不需要回流），
   * 但需要重新繪製畫素。
   */
  color: red;
  background: blue;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  border-color: transparent;
  outline: none;
}

/* 觸發 Layout + Paint + Composite（開銷最大，動畫中要避免） */
.animated-layout {
  /*
   * 這些屬性改變元素的幾何資訊，
   * 導致瀏覽器重新計算佈局（迴流），
   * 然後連帶觸發重繪和合成。
   * 一個元素迴流可能觸發祖先和後代的連鎖迴流。
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

所以核心原則就一句話：**動畫儘量隻用 `transform` 和 `opacity`**。

## 用 transform 替代 layout 屬性

實際開發中最常見的錯誤就是用 `top/left` 做位移動畫：

```css
/* ❌ 差：用 left/top 做位移動畫，每一幀都觸發 Layout */
.mover-bad {
  position: absolute;
  left: 0;
  animation: moveBad 2s ease-in-out infinite alternate;
}

@keyframes moveBad {
  from { left: 0; }
  to   { left: 300px; }
}

/* ✅ 好：用 transform 做位移動畫，隻觸發 Composite */
.mover-good {
  position: absolute;
  left: 0;
  /* 開啟硬體加速的提示 */
  will-change: transform;
  animation: moveGood 2s ease-in-out infinite alternate;
}

@keyframes moveGood {
  from { transform: translateX(0); }
  to   { transform: translateX(300px); }
}
```

同理，改變大小也用 `scale` 而不是 `width/height`：

```css
/* ❌ 差：改變 width/height 觸發 Layout */
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

/* ✅ 好：用 scale 避免迴流 */
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

## will-change 的正確使用

`will-change` 是給瀏覽器的一個最佳化提示，告訴瀏覽器「這個元素即將要變化」，讓瀏覽器提前建立獨立的合成層。

```css
/* ✅ 正確用法：提前宣告即將變化的屬性 */
.optimized-element {
  /*
   * 告訴瀏覽器這個元素的 transform 和 opacity 會變化，
   * 瀏覽器會提前把它提升到獨立的合成層（GPU 紋理）。
   * 這樣動畫開始時就不用再做圖層提升了。
   */
  will-change: transform, opacity;
}

/* ❌ 錯誤用法一：給太多元素加 will-change */
.all-elements > * {
  /*
   * 不要這樣做！每個獨立的合成層都會佔用 GPU 記憶體。
   * 給幾百個元素都加 will-change 會導致視訊記憶體不足，
   * 效能反而更差。
   */
  will-change: transform;
}

/* ❌ 錯誤用法二：把 will-change 寫在永遠線上的樣式裡 */
.always-will-change {
  /*
   * 如果元素的動畫已經結束，應該移除 will-change，
   * 否則它一直佔用 GPU 記憶體。
   * 推薦用 JS 動態新增/移除，或者配合 :hover 使用。
   */
  will-change: transform;
}
```

推薦的 JS 動態管理方式：

```javascript
// 動畫開始前新增 will-change
element.style.willChange = 'transform, opacity';

// 動畫結束後移除
element.addEventListener('transitionend', function handler() {
  element.style.willChange = 'auto';
  element.removeEventListener('transitionend', handler);
});
```

```css
/* 也可以隻在互動態時新增 */
.hover-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-card:hover {
  /* 隻在 hover 時才需要 will-change */
  will-change: transform;
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
```

## 合成層（Composite Layer）詳解

瀏覽器會把頁面分成多個合成層，每一層獨立光柵化，然後由 GPU 合成最終畫面。以下情況會建立新的合成層：

```css
/* 這些 CSS 宣告都會建立獨立的合成層 */

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

/* 4. position: fixed（某些瀏覽器） */
.layer-fixed {
  position: fixed;
}

/* 5. 有 transform 或 opacity 動畫的元素 */
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

「CSS 黑魔法」`transform: translateZ(0)` 就是利用這個原理強製建立合成層。但不要濫用：

```css
/* ⚠️ 用 translateZ(0) 強製 GPU 加速——慎用 */
.gpu-hack {
  /*
   * 這確實能強製建立合成層，讓子元素的動畫在 GPU 上執行。
   * 但如果頁面中大量使用，會消耗大量視訊記憶體。
   * 現代瀏覽器已經足夠智慧，大多數情況下不需要手動 hack。
   * 僅在確實遇到效能問題且測試有效時使用。
   */
  transform: translateZ(0);
}
```

## requestAnimationFrame vs CSS 動畫

什麼時候用 CSS 動畫，什麼時候用 JS（`requestAnimationFrame`）控製動畫？

```css
/* CSS 動畫/過渡：適合簡單、狀態驅動的動畫 */
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
// requestAnimationFrame：適合需要精確控製的動畫
// 例如：跟手拖拽、粒子效果、物理引擎驅動的動畫

function animateWithRAF(element) {
  let startTime = null;
  const duration = 1000; // 1秒

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = (timestamp - startTime) / duration;

    if (progress < 1) {
      // 計算當前位置：ease-out 緩動函式
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = eased * 300;

      // 每幀隻修改 transform，確保走 Composite 路徑
      element.style.transform = `translateX(${x}px)`;
      element.style.opacity = 0.5 + progress * 0.5;

      // 請求下一幀
      requestAnimationFrame(step);
    } else {
      // 動畫結束
      element.style.transform = 'translateX(300px)';
      element.style.opacity = '1';
    }
  }

  requestAnimationFrame(step);
}
```

選擇標準：
- **CSS 動畫**：簡單的過渡、懸停效果、迴圈動畫——瀏覽器可以做很多最佳化
- **requestAnimationFrame**：需要與 JS 邏輯互動、物理模擬、大量元素同步動畫

## 用 DevTools 分析動畫效能

理論講完了，來看實際怎麼排查效能問題。Chrome DevTools 提供了強大的分析工具：

```bash
# 開啟 Chrome DevTools 的方式
# 1. F12 或 Cmd+Option+I (Mac)
# 2. 切換到 Performance 面板
# 3. 勾選 Screenshots 和 Web Vitals
# 4. 點選錄製，在頁面上觸發動畫
# 5. 停止錄製，分析火焰圖
```

關鍵指標怎麼看：

```
Performance 面板中需要關注的指標：
├── FPS（幀率）
│   ├── 綠色條越高越好，目標是穩定的 60fps
│   ├── 紅色區域 = 掉幀，使用者體驗到卡頓
│   └── 幀率低於 30fps 肉眼就能感受到明顯示卡頓
│
├── Frames 行
│   ├── 每個色塊代表一幀
│   ├── 綠色 = 正常
│   ├── 黃色 = 有長任務但沒掉幀
│   └── 紅色 = 掉幀
│
├── Main 執行緒
│   ├── 檢視哪些函式佔用了主執行緒時間
│   ├── 紫色 = Style/Layout
│   ├── 綠色 = Paint
│   └── 找到耗時最長的任務進行最佳化
│
└── Rendering 面板（More tools → Rendering）
    ├── Paint flashing：高亮重繪區域
    ├── Layer borders：顯示合成層邊界
    ├── FPS meter：即時幀率
    └── Scrolling performance issues：滾動效能提示
```

開啟 Paint flashing 的方式：

```
DevTools → 更多工具(More tools) → 渲染(Rendering)
→ 勾選 "Paint flashing"

效果：每次發生重繪的區域會被綠色高亮
目標：動畫過程中，綠色閃爍區域應該儘可能小
如果整個頁面都在閃綠光，說明重繪範圍太大了
```

## 減少重繪區域

有時候雖然用了 `transform`，效能還是不理想，問題可能出在重繪區域太大：

```css
/* 場景：一個固定在底部的操作欄 */
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  /*
   * 問題：如果底欄有 box-shadow、border-radius 等需要重繪的屬性，
   * 當上方內容滾動時，瀏覽器可能需要重新繪製這個底欄所在的區域。
   * 如果底欄層級（z-index）很高，上方內容被遮擋的部分也算在內。
   */
  z-index: 100;
  background: white;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

/* ✅ 最佳化：用 isolation 建立獨立的合成層 */
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
   * 將底欄提升為獨立的合成層，
   * 這樣它不會影響到其他區域的重繪。
   */
  will-change: transform;
  transform: translateZ(0);
}
```

另一個常見的最佳化場景——滾動列表中的動畫元素：

```css
/* 場景：列表項 hover 時有放大效果 */
.list-item {
  /*
   * 問題：如果列表很長（幾百項），
   * hover 放大可能觸發大面積重繪，
   * 因為放大的元素可能會覆蓋相鄰元素。
   */
  transition: transform 0.2s ease;
}

.list-item:hover {
  transform: scale(1.05);
}

/* ✅ 最佳化方案：給每個 item 建立獨立的層 */
.optimized-list-item {
  /*
   * 使用 contain 限製重繪範圍。
   * layout：元素內部的佈局變化不影響外部
   * paint：元素的繪製不會溢位邊界
   */
  contain: layout paint;
  transition: transform 0.2s ease;
  /* 提升到獨立合成層 */
  will-change: transform;
}

.optimized-list-item:hover {
  transform: scale(1.05);
  /* 放大時加陰影，使用 box-shadow 而不是 outline */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

## CSS contain 屬性

`contain` 是一個容易被忽略但非常有用的最佳化屬性：

```css
/*
 * contain 告訴瀏覽器：這個元素內部的變化
 * 不會影響外部的佈局和繪製。
 * 瀏覽器可以據此縮小回流和重繪的範圍。
 */

.strict-card {
  /*
   * contain: strict 等同於 contain: size layout style paint
   * 最嚴格的隔離，但要確保元素大小不依賴內容
   */
  contain: strict;
  width: 300px;
  height: 200px;
}

.content-card {
  /*
   * 常用組合：layout paint
   * - layout：內部迴流不影響外部
   * - paint：內部繪製不溢位邊界
   * 不用 size，因為大多數元素的尺寸依賴內容
   */
  contain: layout paint;
}

.virtual-list-item {
  /*
   * 虛擬列表場景特別有用：
   * 告訴瀏覽器每個列表項是獨立的，
   * 一個列表項的變化不會導致其他列表項迴流/重繪
   */
  contain: layout paint style;
}
```

## 實戰：最佳化一個彈窗動畫

最後用一個綜合示例把所有知識點串起來：

```css
/*
 * 場景：一個從底部滑入的彈窗
 * 要求：60fps 流暢動畫，移動端體驗良好
 */

/* 彈窗遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;

  /* ✅ 僅用 opacity 做淡入淡出 */
  opacity: 0;
  visibility: hidden;
  /* 使用 GPU 加速的過渡 */
  transition: opacity 0.3s ease, visibility 0.3s ease;

  /* 提示瀏覽器準備變化 */
  will-change: opacity;
}

.modal-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* 彈窗主體 */
.modal-content {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-radius: 16px 16px 0 0;
  z-index: 1001;
  /* 提前設定最終尺寸，避免動畫中迴流 */
  height: 70vh;

  /* ✅ 僅用 transform 做位移動畫 */
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);

  /* 提前告知瀏覽器 */
  will-change: transform;

  /* ✅ 限製重繪範圍 */
  contain: layout paint;
}

.modal-content.active {
  transform: translateY(0);
}

/* 動畫結束後移除 will-change */
/* 這一步通過 JS 的 transitionend 事件實現 */
```

```javascript
// 動畫結束後移除 will-change，釋放 GPU 記憶體
const overlay = document.querySelector('.modal-overlay');
const content = document.querySelector('.modal-content');

function openModal() {
  content.style.willChange = 'transform';
  overlay.style.willChange = 'opacity';
  // 強製迴流確保 will-change 生效（讀取 offsetHeight 即可觸發）
  void content.offsetHeight;
  overlay.classList.add('active');
  content.classList.add('active');
}

function closeModal() {
  overlay.classList.remove('active');
  content.classList.remove('active');
}

// 監聽 transitionend 事件，動畫完成後清理
content.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'transform' && !content.classList.contains('active')) {
    // 彈窗關閉動畫結束，移除 will-change
    content.style.willChange = 'auto';
    overlay.style.willChange = 'auto';
  }
});
```

## 小結

- 動畫屬性選擇的核心原則：優先使用 `transform` 和 `opacity`，它們隻觸發 Composite，跳過 Layout 和 Paint
- `will-change` 是最佳化提示而非萬能藥——隻在動畫即將發生時新增，動畫結束後移除，避免濫用導致視訊記憶體不足
- `contain: layout paint` 可以有效縮小回流和重繪的影響範圍
- CSS 動畫適合簡單的狀態驅動動畫，`requestAnimationFrame` 適合需要精確控製的複雜動畫
- 善用 DevTools 的 Performance 面板和 Paint flashing 來定位真正的效能瓶頸，不要憑感覺最佳化
