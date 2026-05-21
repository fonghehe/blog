---
title: "前端性能優化：搞清關鍵渲染路徑"
date: 2018-01-11 17:34:30
tags:
  - 性能優化
readingTime: 3
description: "做性能優化之前，要先搞清楚瀏覽器從收到 HTML 到用戶睇到頁面，中間經歷咗咩。呢啲步驟合埋一齊叫做**關鍵渲染路徑**（Critical Rendering Path）。唔理解呢個，好多優化手段只能照貓畫虎。"
wordCount: 630
---

做性能優化之前，要先搞清楚瀏覽器從收到 HTML 到用戶睇到頁面，中間經歷咗咩。呢啲步驟合埋一齊叫做**關鍵渲染路徑**（Critical Rendering Path）。唔理解呢個，好多優化手段只能照貓畫虎。

## 瀏覽器渲染嘅五個步驟

1. **解析 HTML，構建 DOM 樹**
2. **解析 CSS，構建 CSSOM 樹**
3. **合併 DOM 同 CSSOM，生成渲染樹（Render Tree）**
4. **佈局（Layout/Reflow）**：計算每個節點嘅位置同大小
5. **繪製（Paint）**：將渲染樹轉換為螢幕上嘅像素

呢五步裡面，1 同 2 係並行嘅，但有一個關鍵阻塞規則：**CSS 阻塞渲染，JS 阻塞解析**。

## CSS 阻塞渲染

瀏覽器必須等待 CSSOM 構建完成先至可以開始渲染。原因好簡單：如果先渲染再等 CSS，用戶會睇到樣式閃爍（FOUC，Flash of Unstyled Content）。

```html
<!-- 呢個 CSS 文件嘅下載同解析會阻塞頁面渲染 -->
<link rel="stylesheet" href="/styles/main.css" />
```

優化方向：

- 減小 CSS 文件體積，移除未用樣式（PurgeCSS）
- 內聯關鍵 CSS（首屏可見區域嘅樣式）
- 非關鍵 CSS 異步加載

```html
<!-- 內聯關鍵 CSS -->
<style>
  /* 僅包含首屏需要嘅樣式 */
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .header {
    height: 60px;
    background: #fff;
  }
</style>

<!-- 非關鍵 CSS 異步加載 -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
```

## JS 阻塞 HTML 解析

當 HTML 解析器遇到 `<script>` 標籤時，會**暫停 DOM 構建**，等待 JS 下載同埋執行完成。原因係 JS 可能修改 DOM（`document.write`）。

```html
<!-- 唔好：阻塞 DOM 解析，首屏白屏時間長 -->
<head>
  <script src="/js/app.js"></script>
</head>

<!-- 較好：放到 body 底部，DOM 解析完再執行 -->
<body>
  <!-- 頁面內容 -->
  <script src="/js/app.js"></script>
</body>
```

更好嘅方式係用 `defer` 或 `async`：

```html
<!-- defer：異步下載，DOM 解析完成後按順序執行 -->
<script defer src="/js/vendor.js"></script>
<script defer src="/js/app.js"></script>

<!-- async：異步下載，下載完立即執行（唔保證順序） -->
<script async src="/js/analytics.js"></script>
```

`defer` 適合大多數應用腳本，`async` 適合獨立嘅第三方腳本（統計、廣告）。

## 重排（Reflow）同重繪（Repaint）

渲染完成後，修改 DOM 或樣式會觸發重新渲染：

- **重排**（Reflow/Layout）：元素幾何屬性改變，重新計算所有受影響元素嘅位置大小。代價最高。
- **重繪**（Repaint）：元素外觀改變（顏色、背景），唔影響佈局。代價居中。
- **合成**（Composite）：只影響 transform、opacity，喺獨立嘅合成層處理。代價最低。

```javascript
// 觸發重排嘅屬性（讀取呢啲屬性都會強制瀏覽器同步計算）
(element.offsetWidth, offsetHeight, offsetTop, offsetLeft);
(element.scrollWidth, scrollHeight, scrollTop);
(element.clientWidth, clientHeight);
window.getComputedStyle(element);

// 避免喺循環裡面讀寫混合（強制同步佈局）
// 唔好：每次循環都強制瀏覽器重新計算佈局
for (let i = 0; i < items.length; i++) {
  items[i].style.width = container.offsetWidth + "px"; // 讀 + 寫
}

// 較好：先讀後批量寫
const containerWidth = container.offsetWidth; // 讀一次
for (let i = 0; i < items.length; i++) {
  items[i].style.width = containerWidth + "px"; // 只寫
}
```

## 利用合成層做高性能動畫

將動畫元素提升到獨立嘅合成層，動畫就唔會觸發重排同重繪：

```css
.animated-element {
  /* 提示瀏覽器呢個元素會變化，提前創建合成層 */
  will-change: transform;

  /* 或者用舊方式強制創建合成層 */
  transform: translateZ(0);
}

/* 高性能動畫：只用 transform 同 opacity */
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

唔好濫用 `will-change`，每個合成層都佔用 GPU 記憶體。頁面上幾百個元素都加 `will-change` 反而會令性能變差。

## 用 Chrome DevTools 搵瓶頸

1. 打開 DevTools，切到 **Performance** 面板
2. 點擊錄製，執行操作，停止錄製
3. 查看火焰圖，重點關注：
   - 紫色嘅 **Layout** 塊（重排）
   - 綠色嘅 **Paint** 塊（重繪）
   - 搵「長任務」（超過 50ms 嘅任務塊）

一旦搵到具體嘅重排/重繪觸發點，對症下藥比盲目優化效率高好多。

---

_下一篇：ES2017 async/await 最佳實踐_
