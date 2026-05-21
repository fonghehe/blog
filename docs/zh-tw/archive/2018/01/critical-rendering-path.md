---
title: "前端效能優化：搞懂關鍵渲染路徑"
date: 2018-01-11 17:34:30
tags:
  - 性能優化
readingTime: 3
description: "做效能優化之前，得先搞清楚瀏覽器從收到 HTML 到使用者看到頁面，中間經歷了什麼。這些步驟合在一起叫做**關鍵渲染路徑**（Critical Rendering Path）。不理解這個，很多優化手段只能照葫蘆畫瓢。"
wordCount: 634
---

做效能優化之前，得先搞清楚瀏覽器從收到 HTML 到使用者看到頁面，中間經歷了什麼。這些步驟合在一起叫做**關鍵渲染路徑**（Critical Rendering Path）。不理解這個，很多優化手段只能照葫蘆畫瓢。

## 瀏覽器渲染的五個步驟

1. **解析 HTML，建構 DOM 樹**
2. **解析 CSS，建構 CSSOM 樹**
3. **合併 DOM 和 CSSOM，產生渲染樹（Render Tree）**
4. **佈局（Layout/Reflow）**：計算每個節點的位置和大小
5. **繪製（Paint）**：把渲染樹轉換為螢幕上的像素

這五步裡，1 和 2 是並行的，但有一個關鍵阻塞規則：**CSS 阻塞渲染，JS 阻塞解析**。

## CSS 阻塞渲染

瀏覽器必須等待 CSSOM 建構完成才能開始渲染。原因很簡單：如果先渲染再等 CSS，使用者會看到樣式閃爍（FOUC，Flash of Unstyled Content）。

```html
<!-- 這個 CSS 檔案的下載和解析會阻塞頁面渲染 -->
<link rel="stylesheet" href="/styles/main.css" />
```

優化方向：

- 縮小 CSS 檔案體積，移除未用樣式（PurgeCSS）
- 內嵌關鍵 CSS（首屏可見區域的樣式）
- 非關鍵 CSS 非同步載入

```html
<!-- 內嵌關鍵 CSS -->
<style>
  /* 僅包含首屏需要的樣式 */
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .header {
    height: 60px;
    background: #fff;
  }
</style>

<!-- 非關鍵 CSS 非同步載入 -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
```

## JS 阻塞 HTML 解析

當 HTML 解析器遇到 `<script>` 標籤時，會**暫停 DOM 建構**，等待 JS 下載並執行完成。原因是 JS 可能修改 DOM（`document.write`）。

```html
<!-- 不好：阻塞 DOM 解析，首屏白屏時間長 -->
<head>
  <script src="/js/app.js"></script>
</head>

<!-- 較好：放到 body 底部，DOM 解析完再執行 -->
<body>
  <!-- 頁面內容 -->
  <script src="/js/app.js"></script>
</body>
```

更好的方式是用 `defer` 或 `async`：

```html
<!-- defer：非同步下載，DOM 解析完成後依序執行 -->
<script defer src="/js/vendor.js"></script>
<script defer src="/js/app.js"></script>

<!-- async：非同步下載，下載完立刻執行（不保證順序） -->
<script async src="/js/analytics.js"></script>
```

`defer` 適合大多數應用腳本，`async` 適合獨立的第三方腳本（統計、廣告）。

## 重排（Reflow）和重繪（Repaint）

渲染完成後，修改 DOM 或樣式會觸發重新渲染：

- **重排**（Reflow/Layout）：元素幾何屬性改變，重新計算所有受影響元素的位置大小。代價最高。
- **重繪**（Repaint）：元素外觀改變（顏色、背景），不影響佈局。代價居中。
- **合成**（Composite）：僅影響 transform、opacity，在獨立的合成層處理。代價最低。

```javascript
// 觸發重排的屬性（讀取這些屬性也會強制瀏覽器同步計算）
(element.offsetWidth, offsetHeight, offsetTop, offsetLeft);
(element.scrollWidth, scrollHeight, scrollTop);
(element.clientWidth, clientHeight);
window.getComputedStyle(element);

// 避免在迴圈裡讀寫混合（強制同步佈局）
// 不好：每次迴圈都強制瀏覽器重新計算佈局
for (let i = 0; i < items.length; i++) {
  items[i].style.width = container.offsetWidth + "px"; // 讀 + 寫
}

// 較好：先讀後批次寫入
const containerWidth = container.offsetWidth; // 讀一次
for (let i = 0; i < items.length; i++) {
  items[i].style.width = containerWidth + "px"; // 只寫
}
```

## 利用合成層做高效能動畫

把動畫元素提升到獨立的合成層，動畫就不會觸發重排和重繪：

```css
.animated-element {
  /* 提示瀏覽器這個元素會變化，提前建立合成層 */
  will-change: transform;

  /* 或者用舊方式強制建立合成層 */
  transform: translateZ(0);
}

/* 高效能動畫：只用 transform 和 opacity */
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

不要濫用 `will-change`，每個合成層都佔用 GPU 記憶體。頁面上幾百個元素都加 `will-change` 反而會讓效能變差。

## 用 Chrome DevTools 找瓶頸

1. 開啟 DevTools，切到 **Performance** 面板
2. 點擊錄製，執行操作，停止錄製
3. 查看火焰圖，重點關注：
   - 紫色的 **Layout** 區塊（重排）
   - 綠色的 **Paint** 區塊（重繪）
   - 找「長任務」（超過 50ms 的任務區塊）

一旦找到具體的重排/重繪觸發點，對症下藥比盲目優化效率高很多。

---

_下一篇：ES2017 async/await 最佳實踐_
