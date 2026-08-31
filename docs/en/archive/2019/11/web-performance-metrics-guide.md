---
title: "Web Vitals: Core Performance Metrics Guide"
date: 2019-11-14 16:51:28
tags:
  - Performance Optimization
readingTime: 4
description: "Google has been pushing to standardize web performance, proposing a set of core metrics to measure user experience. These metrics focus on three dimensions: loading speed, interactivity, and visual stability. This article explains what each metric means and how to measure it."
wordCount: 439
---

Google has been pushing to standardize web performance, proposing a set of core metrics to measure user experience. These metrics focus on three dimensions: loading speed, interactivity, and visual stability. This article explains what each metric means and how to measure it.

## Performance Metrics Overview

Google's core performance metrics mainly include:

- **LCP (Largest Contentful Paint)**: measures loading performance
- **FID (First Input Delay)**: measures interactivity
- **CLS (Cumulative Layout Shift)**: measures visual stability

Along with some supporting metrics:

- **FCP (First Contentful Paint)**: first content paint
- **TTI (Time to Interactive)**: time to interactive
- **TBT (Total Blocking Time)**: total blocking time
- **TTFB (Time to First Byte)**: time to first byte

## FCP - First Contentful Paint

FCP measures the time from when the page starts loading until the first piece of content (text, image, or SVG) appears on screen:

```js
// 使用 Performance API 测量 FCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      console.log('FCP:', entry.startTime);
      observer.disconnect();
    }
  }
});

observer.observe({ type: 'paint', buffered: true });

// 也可以通过 PerformancePaintTiming 获取
const paintEntries = performance.getEntriesByType('paint');
const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
console.log('FCP:', fcp.startTime);
```

FCP rating thresholds:
- Good: <= 1.8 s
- Needs improvement: 1.8 - 3 s
- Poor: > 3 s

## LCP - Largest Contentful Paint

LCP measures when the largest content element (image, video, or text block) within the viewport is painted. It reflects perceived loading speed better than FCP:

```js
// 测量 LCP
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  // LCP 可能会更新（每次页面出现更大的内容元素）
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime);
  console.log('LCP 元素:', lastEntry.element);
});

lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// 页面完全加载后，断开观察者
window.addEventListener('load', () => {
  // 延迟断开，确保捕获最终的 LCP
  setTimeout(() => lcpObserver.disconnect(), 1000);
});
```

LCP rating thresholds:
- Good: <= 2.5 s
- Needs improvement: 2.5 - 4 s
- Poor: > 4 s

Factors affecting LCP and optimization strategies:

```html
<!-- 1. 优化关键资源加载 -->
<link rel="preload" href="/hero-image.webp" as="image">

<!-- 2. 使用适当的图片格式 -->
<picture>
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="Hero" loading="eager" width="1200" height="600">
</picture>

<!-- 3. 服务端渲染关键内容 -->
<!-- 不要依赖客户端 JS 来渲染主要内容 -->
```

```js
// 4. 优化关键 CSS
// 内联关键 CSS，异步加载非关键 CSS
const nonCriticalCSS = document.createElement('link');
nonCriticalCSS.rel = 'stylesheet';
nonCriticalCSS.href = '/styles/non-critical.css';
document.head.appendChild(nonCriticalCSS);

// 5. 优化字体加载
// 使用 font-display: swap 避免文字闪烁
```

## FID - First Input Delay

FID measures the gap between a user's first interaction with the page (click, input, etc.) and the browser actually starting to process that interaction:

```js
// 测量 FID
const fidObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // processingStart - startTime = 输入延迟
    const delay = entry.processingStart - entry.startTime;
    console.log('FID:', delay);
    console.log('事件类型:', entry.name);
    fidObserver.disconnect(); // FID 只记录第一次交互
  }
});

fidObserver.observe({ type: 'first-input', buffered: true });
```

FID rating thresholds:
- Good: <= 100 ms
- Needs improvement: 100 - 300 ms
- Poor: > 300 ms

The main cause of poor FID is the main thread being blocked by long tasks:

```js
// 优化长任务：拆分为多个小任务
function processLargeArray(items) {
  // 差：一次性处理所有数据，阻塞主线程
  // items.forEach(item => heavyProcessing(item));

  // 好：分批处理，每批之间让出主线程
  const batchSize = 100;
  let index = 0;

  function processBatch() {
    const batch = items.slice(index, index + batchSize);
    batch.forEach(item => heavyProcessing(item));
    index += batchSize;

    if (index < items.length) {
      // 使用 MessageChannel 或 setTimeout 让出主线程
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

## CLS - Cumulative Layout Shift

CLS measures how much the visible content shifts unexpectedly while the page loads. It is the only metric without a time unit:

```js
// 测量 CLS
let clsValue = 0;
let clsEntries = [];
let sessionValue = 0;
let sessionEntries = [];

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // 只有没有 recentInput（用户最近输入）的偏移才计入
    if (!entry.hadRecentInput) {
      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // 如果当前 session 距离上一次偏移超过 1 秒，或总时长超过 5 秒，开始新 session
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

CLS rating thresholds:
- Good: <= 0.1
- Needs improvement: 0.1 - 0.25
- Poor: > 0.25

Common causes of layout shift and how to fix them:

```html
<!-- 1. 为图片设置宽高 -->
<!-- 差：没有尺寸，图片加载后会撑开容器 -->
<img src="photo.jpg" alt="照片">

<!-- 好：预设宽高 -->
<img src="photo.jpg" alt="照片" width="800" height="600">

<!-- 2. 为视频/iframe/广告预留空间 -->
<div style="aspect-ratio: 16/9;">
  <video src="video.mp4"></video>
</div>

<!-- 3. 避免在已有内容上方插入新内容 -->
<!-- 差：动态插入 banner 导致下方内容下移 -->
<!-- 好：使用固定高度的预留区域 -->

<!-- 4. 使用 CSS contain 属性限制影响范围 -->
<style>
.ad-container {
  contain: layout;
  min-height: 250px; /* 预留广告位高度 */
}
</style>
```

## Comprehensive Measurement Solution

The `web-vitals` library makes it easy to collect all the core metrics:

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
    // 自定义数据
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  // 使用 Beacon API 发送数据
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

## Measuring in DevTools

Chrome DevTools provides several measurement tools:

1. **Lighthouse**: run a Lighthouse audit directly from the Performance panel
2. **Performance panel**: record the page load and inspect markers like FCP and LCP
3. **Performance Monitor**: live-monitor metrics like CPU, memory, and layout

```js
// 在代码中标记自定义性能点
performance.mark('my-feature-start');
// ... 执行某个操作
performance.mark('my-feature-end');
performance.measure('my-feature', 'my-feature-start', 'my-feature-end');

const measures = performance.getEntriesByName('my-feature');
console.log('耗时:', measures[0].duration.toFixed(2), 'ms');
```

## Summary

- FCP measures when the first content appears, reflecting initial load speed
- LCP measures the largest content element's paint time, closer to user perception
- FID measures first-interaction delay, reflecting responsiveness
- CLS measures accumulated layout shift, reflecting visual stability
- Splitting long tasks, reserving image dimensions, and font optimization are common performance techniques
- The `web-vitals` library makes collecting and reporting all core metrics easy
- The Performance panel and Lighthouse in DevTools are the main tools for debugging performance
