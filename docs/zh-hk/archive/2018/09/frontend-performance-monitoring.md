---
title: "前端性能監控實踐"
date: 2018-09-30 10:45:26
tags:
  - 性能優化
readingTime: 1
description: "做了一段時間性能優化，但一直沒有系統地監控線上性能。研究了一下如何把性能數據收集起來。"
---

做了一段時間性能優化，但一直沒有系統地監控線上性能。研究了一下如何把性能數據收集起來。

## 為什麼需要線上監控

```
DevTools 測的是你本機的情況
真實用户可能在：
  - 2G/3G 網絡
  - 低端安卓手機
  - 網絡不穩定的地區

線上監控才能知道真實用户的體驗
```

## Performance API

瀏覽器內置的性能時間戳：

```javascript
// 獲取各階段時間
const timing = performance.timing;

// 常用指標計算
const metrics = {
  // DNS 解析時間
  dns: timing.domainLookupEnd - timing.domainLookupStart,
  // TCP 連接時間
  tcp: timing.connectEnd - timing.connectStart,
  // 首字節時間（TTFB）
  ttfb: timing.responseStart - timing.requestStart,
  // 頁面完全加載時間
  load: timing.loadEventEnd - timing.navigationStart,
  // DOM 解析時間
  domParse: timing.domInteractive - timing.responseEnd,
  // 白屏時間（近似值）
  whiteScreen: timing.domLoading - timing.navigationStart,
};

console.log(metrics);
```

## 使用 PerformanceObserver

```javascript
// 監聽 LCP（最大內容繪製）
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log("LCP:", lastEntry.startTime);
  reportMetric("lcp", lastEntry.startTime);
});
lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

// 監聽 FID（首次輸入延遲）
const fidObserver = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log("FID:", entry.processingStart - entry.startTime);
  reportMetric("fid", entry.processingStart - entry.startTime);
});
fidObserver.observe({ entryTypes: ["first-input"] });

// 監聽 CLS（累積佈局位移）
let clsScore = 0;
const clsObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) {
      clsScore += entry.value;
    }
  });
});
clsObserver.observe({ entryTypes: ["layout-shift"] });

// 頁面離開時上報 CLS
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    reportMetric("cls", clsScore);
  }
});
```

## 資源加載監控

```javascript
// 獲取所有資源的加載時間
const resources = performance.getEntriesByType("resource");
resources.forEach((resource) => {
  if (resource.duration > 1000) {
    // 超過 1s 的資源記錄下來
    console.warn("慢資源:", resource.name, resource.duration + "ms");
  }
});
```

## 上報到後端

```javascript
function reportMetric(name, value) {
  // 用 sendBeacon 上報（不阻塞頁面卸載，比 fetch 更可靠）
  const data = JSON.stringify({
    metric: name,
    value: Math.round(value),
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  navigator.sendBeacon("/api/metrics", data);
}
```

## 實際上線後的問題

上了監控之後發現：

```
- 移動端用户的 LCP 比桌面端慢 3 倍
- 某個城市的 TTFB 特別高（CDN 節點問題）
- 一個第三方廣告腳本讓 CLS 爆表
```

沒有數據的時候，這些問題永遠發現不了。

## 小結

- `performance.timing`：各階段時間戳（TTFB、DNS、TCP 等）
- `PerformanceObserver`：監聽 LCP、FID、CLS 等指標
- `navigator.sendBeacon`：頁面卸載時可靠上報數據
- 線上監控是發現真實性能問題的唯一方式，本機 DevTools 不夠