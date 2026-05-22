---
title: "Web Vitals 核心效能指標入門：實踐方法與治理思路"
date: 2019-11-14 16:51:28
tags:
  - 性能優化
readingTime: 4
description: "Google 一直在推動 Web 效能的標準化，提出了一系列核心效能指標來衡量用户體驗。這些指標關注加載速度、交互性和視覺穩定性三個維度。本文將介紹這些指標的含義和測量方法。"
wordCount: 706
---

Google 一直在推動 Web 性能的標準化，提出了一系列核心性能指標來衡量用户體驗。這些指標關注加載速度、交互性和視覺穩定性三個維度。本文將介紹這些指標的含義和測量方法。

## 效能指標概覽

Google 提出的核心性能指標主要包括：

- **LCP（Largest Contentful Paint）**：最大內容繪製，衡量加載性能
- **FID（First Input Delay）**：首次輸入延遲，衡量交互性
- **CLS（Cumulative Layout Shift）**：累積佈局偏移，衡量視覺穩定性

以及一些輔助指標：

- **FCP（First Contentful Paint）**：首次內容繪製
- **TTI（Time to Interactive）**：可交互時間
- **TBT（Total Blocking Time）**：總阻塞時間
- **TTFB（Time to First Byte）**：首字節時間

## FCP - 首次內容繪製

FCP 測量頁面從開始加載到第一個內容（文字、圖片、SVG）出現在屏幕上的時間：

```js
// 使用 Performance API 測量 FCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      console.log('FCP:', entry.startTime);
      observer.disconnect();
    }
  }
});

observer.observe({ type: 'paint', buffered: true });

// 也可以通過 PerformancePaintTiming 獲取
const paintEntries = performance.getEntriesByType('paint');
const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
console.log('FCP:', fcp.startTime);
```

FCP 評級標準：
- 好：<= 1.8 秒
- 需要改進：1.8 - 3 秒
- 差：> 3 秒

## LCP - 最大內容繪製

LCP 測量視口內最大內容元素（圖片、視頻、文本塊）的繪製時間。它比 FCP 更能反映用户感知的加載速度：

```js
// 測量 LCP
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  // LCP 可能會更新（每次頁面出現更大的內容元素）
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime);
  console.log('LCP 元素:', lastEntry.element);
});

lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// 頁面完全加載後，斷開觀察者
window.addEventListener('load', () => {
  // 延遲斷開，確保捕獲最終的 LCP
  setTimeout(() => lcpObserver.disconnect(), 1000);
});
```

LCP 評級標準：
- 好：<= 2.5 秒
- 需要改進：2.5 - 4 秒
- 差：> 4 秒

影響 LCP 的因素和優化策略：

```html
<!-- 1. 優化關鍵資源加載 -->
<link rel="preload" href="/hero-image.webp" as="image">

<!-- 2. 使用適當的圖片格式 -->
<picture>
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="Hero" loading="eager" width="1200" height="600">
</picture>

<!-- 3. 服務端渲染關鍵內容 -->
<!-- 不要依賴客户端 JS 來渲染主要內容 -->
```

```js
// 4. 優化關鍵 CSS
// 內聯關鍵 CSS，異步加載非關鍵 CSS
const nonCriticalCSS = document.createElement('link');
nonCriticalCSS.rel = 'stylesheet';
nonCriticalCSS.href = '/styles/non-critical.css';
document.head.appendChild(nonCriticalCSS);

// 5. 優化字體加載
// 使用 font-display: swap 避免文字閃爍
```

## FID - 首次輸入延遲

FID 測量用户第一次與頁面交互（點擊、輸入等）到瀏覽器實際開始處理該交互的時間差：

```js
// 測量 FID
const fidObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // processingStart - startTime = 輸入延遲
    const delay = entry.processingStart - entry.startTime;
    console.log('FID:', delay);
    console.log('事件類型:', entry.name);
    fidObserver.disconnect(); // FID 隻記錄第一次交互
  }
});

fidObserver.observe({ type: 'first-input', buffered: true });
```

FID 評級標準：
- 好：<= 100ms
- 需要改進：100 - 300ms
- 差：> 300ms

影響 FID 的主要原因是主線程被長任務阻塞：

```js
// 優化長任務：拆分為多個小任務
function processLargeArray(items) {
  // 差：一次性處理所有數據，阻塞主線程
  // items.forEach(item => heavyProcessing(item));

  // 好：分批處理，每批之間讓出主線程
  const batchSize = 100;
  let index = 0;

  function processBatch() {
    const batch = items.slice(index, index + batchSize);
    batch.forEach(item => heavyProcessing(item));
    index += batchSize;

    if (index < items.length) {
      // 使用 MessageChannel 或 setTimeout 讓出主線程
      setTimeout(processBatch, 0);
    }
  }

  processBatch();
}

// 或使用 requestIdleCallback
function processOnIdle(items) {
  function processNext(deadline) {
    while (deadline.timeRemaining() > 0 && items.length > 0) {
      const item = items.shift();
      heavyProcessing(item);
    }
    if (items.length > 0) {
      requestIdleCallback(processNext);
    }
  }
  requestIdleCallback(processNext);
}
```

## CLS - 累積佈局偏移

CLS 測量頁面可見內容在加載過程中意外移動的程度。它是唯一沒有時間單位的指標：

```js
// 測量 CLS
let clsValue = 0;
let clsEntries = [];
let sessionValue = 0;
let sessionEntries = [];

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // 隻有沒有 recentInput（用户最近輸入）的偏移才計入
    if (!entry.hadRecentInput) {
      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // 如果當前 session 距離上一次偏移超過 1 秒，或總時長超過 5 秒，開始新 session
      if (
        firstSessionEntry &&
        entry.startTime - lastSessionEntry.startTime < 1000 &&
        entry.startTime - firstSessionEntry.startTime < 5000
      ) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = entry.value;
        sessionEntries = [entry];
      }

      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = sessionEntries;
        console.log('CLS:', clsValue);
      }
    }
  }
});

clsObserver.observe({ type: 'layout-shift', buffered: true });
```

CLS 評級標準：
- 好：<= 0.1
- 需要改進：0.1 - 0.25
- 差：> 0.25

常見的佈局偏移原因和解決方案：

```html
<!-- 1. 為圖片設置寬高 -->
<!-- 差：沒有尺寸，圖片加載後會撐開容器 -->
<img src="photo.jpg" alt="照片">

<!-- 好：預設寬高 -->
<img src="photo.jpg" alt="照片" width="800" height="600">

<!-- 2. 為視頻/iframe/廣告預留空間 -->
<div style="aspect-ratio: 16/9;">
  <video src="video.mp4"></video>
</div>

<!-- 3. 避免在已有內容上方插入新內容 -->
<!-- 差：動態插入 banner 導致下方內容下移 -->
<!-- 好：使用固定高度的預留區域 -->

<!-- 4. 使用 CSS contain 屬性限製影響範圍 -->
<style>
.ad-container {
  contain: layout;
  min-height: 250px; /* 預留廣告位高度 */
}
</style>
```

## 綜合測量方案

使用 `web-vitals` 庫可以方便地收集所有核心指標：

```bash
npm install web-vitals
```

```js
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    // 自定義數據
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  // 使用 Beacon API 發送數據
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

## 在 DevTools 中測量

Chrome DevTools 提供了多種測量工具：

1. **Lighthouse**：Performance 面板直接運行 Lighthouse 審計
2. **Performance 面板**：錄製頁面加載過程，查看 FCP、LCP 等標記
3. **Performance Monitor**：實時監控 CPU、內存、佈局等指標

```js
// 在代碼中標記自定義性能點
performance.mark('my-feature-start');
// ... 執行某個操作
performance.mark('my-feature-end');
performance.measure('my-feature', 'my-feature-start', 'my-feature-end');

const measures = performance.getEntriesByName('my-feature');
console.log('耗時:', measures[0].duration.toFixed(2), 'ms');
```

## 小結

- FCP 測量首次內容出現的時間，反映初始加載速度
- LCP 測量最大內容元素的繪製時間，更接近用户感知
- FID 測量首次交互的延遲，反映頁面響應性
- CLS 測量佈局偏移的累積程度，反映視覺穩定性
- 長任務拆分、圖片尺寸預設、字體優化是常見的性能手段
- `web-vitals` 庫可以方便地收集和上報所有核心指標
- DevTools 的 Performance 面板和 Lighthouse 是調試性能的主要工具
