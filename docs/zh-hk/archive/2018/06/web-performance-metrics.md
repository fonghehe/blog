---
title: "前端性能指標：FCP、TTI、FID 是什麼"
date: 2018-06-23 15:02:42
tags:
  - 性能優化
readingTime: 2
description: "最近在做性能優化，發現很多人（包括我自己）對性能指標的理解比較模糊。整理一下常用的指標含義。"
wordCount: 518
---

最近在做性能優化，發現很多人（包括我自己）對性能指標的理解比較模糊。整理一下常用的指標含義。

## 核心指標

### FP（First Paint）首次繪製

瀏覽器第一次渲染任何像素的時間。可能只是一個背景色，用户感知不強。

### FCP（First Contentful Paint）首次內容繪製

第一次渲染文字、圖片、SVG 或非白色 canvas 的時間。用户第一次看到"有內容"的時刻。

**目標**：< 1.8 秒（Google 標準）

### LCP（Largest Contentful Paint）最大內容繪製

視口內最大的文字或圖片塊完成渲染的時間。代表主要內容加載完成。

**目標**：< 2.5 秒

### TTI（Time to Interactive）可交互時間

頁面完全可以響應用户操作的時間（主線程空閒，事件處理器已綁定）。

**目標**：< 3.8 秒

### FID（First Input Delay）首次輸入延遲

用户第一次與頁面交互（點擊、輸入）到瀏覽器實際開始處理的延遲時間。

**目標**：< 100ms

### CLS（Cumulative Layout Shift）累積佈局偏移

頁面加載過程中意外的佈局偏移總量。圖片沒有指定寬高、動態插入內容會導致高 CLS。

**目標**：< 0.1

## 如何測量

### Chrome DevTools

```
Performance 面板 → 錄製 → 查看 Timings 部分
```

### Lighthouse

```bash
npm install -g lighthouse
lighthouse https://example.com --output html --output-path report.html
```

### Performance API（代碼中測量）

```javascript
// 監聽 FCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      console.log("FCP:", entry.startTime, "ms");
    }
  }
});
observer.observe({ entryTypes: ["paint"] });

// 獲取導航時間（TTFB 等）
const timing = performance.getEntriesByType("navigation")[0];
console.log("TTFB:", timing.responseStart - timing.fetchStart);
console.log("DOM Ready:", timing.domContentLoadedEventEnd - timing.fetchStart);
console.log("Page Load:", timing.loadEventEnd - timing.fetchStart);
```

## 常見問題與優化方向

| 指標差 | 可能原因                | 優化方向                        |
| 
------ | ----------------------- | ------------------------------- |
| FCP 慢 | JS 阻塞渲染、字體加載慢 | 減少阻塞資源、內聯關鍵 CSS      |
| LCP 慢 | 大圖、服務器慢          | 圖片優化、CDN、preload 關鍵圖片 |
| TTI 慢 | JS 過多、主線程繁忙     | 代碼分割、減少 JS               |
| FID 高 | 長任務阻塞主線程        | 拆分長任務、延遲非關鍵 JS       |
| CLS 高 | 圖片無尺寸、廣告插入    | 給所有圖片/視頻指定寬高         |

## 小結

- FCP：用户看到內容的時刻（< 1.8s）
- LCP：主要內容加載完成（< 2.5s）
- TTI：頁面真正可交互的時刻（< 3.8s）
- FID：第一次點擊的響應延遲（< 100ms）
- CLS：佈局穩定性（< 0.1）
- 用 Lighthouse 定期跑分，發現問題
