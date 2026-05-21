---
title: "Web Vitals：コアパフォーマンス指標ガイド"
date: 2019-11-14 16:51:28
tags:
  - パフォーマンス最適化
readingTime: 4
description: "Google 一直在推动 Web 性能的标准化，提出了一系列核心性能指标来衡量用户体验。这些指标关注加载速度、交互性和视觉稳定性三个维度。本文将介绍这些指标的含义和测量方法。"
wordCount: 730
---

Google 一直在推动 Web 性能的标准化，提出了一系列核心性能指标来衡量用户体验。这些指标关注加载速度、交互性和视觉稳定性三个维度。本文将介绍这些指标的含义和测量方法。

## パフォーマンス指標の概要

Google 提出的核心性能指标主要包括：

- **LCP（Largest Contentful Paint）**：最大内容绘制，衡量加载性能
- **FID（First Input Delay）**：首次输入延迟，衡量交互性
- **CLS（Cumulative Layout Shift）**：累积布局偏移，衡量视觉稳定性

以及一些辅助指标：

- **FCP（First Contentful Paint）**：首次内容绘制
- **TTI（Time to Interactive）**：可交互时间
- **TBT（Total Blocking Time）**：总阻塞时间
- **TTFB（Time to First Byte）**：首字节时间

## FCP - 初回コンテンツ描画

FCP 测量页面从开始加载到第一个内容（文字、图片、SVG）出现在屏幕上的时间：

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

FCP 评级标准：
- 好：<= 1.8 秒
- 需要改进：1.8 - 3 秒
- 差：> 3 秒

## LCP - 最大コンテンツ描画

LCP 测量视口内最大内容元素（图片、视频、文本块）的绘制时间。它比 FCP 更能反映用户感知的加载速度：

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

LCP 评级标准：
- 好：<= 2.5 秒
- 需要改进：2.5 - 4 秒
- 差：> 4 秒

影响 LCP 的因素和优化策略：

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

## FID - 初回入力遅延

FID 测量用户第一次与页面交互（点击、输入等）到浏览器实际开始处理该交互的时间差：

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

FID 评级标准：
- 好：<= 100ms
- 需要改进：100 - 300ms
- 差：> 300ms

影响 FID 的主要原因是主线程被长任务阻塞：

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

## CLS - 累積レイアウトシフト

CLS 测量页面可见内容在加载过程中意外移动的程度。它是唯一没有时间单位的指标：

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

CLS 评级标准：
- 好：<= 0.1
- 需要改进：0.1 - 0.25
- 差：> 0.25

常见的布局偏移原因和解决方案：

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

## 総合的な計測ソリューション

使用 `web-vitals` 库可以方便地收集所有核心指标：

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

## DevToolsでの計測

Chrome DevTools 提供了多种测量工具：

1. **Lighthouse**：Performance 面板直接运行 Lighthouse 审计
2. **Performance 面板**：录制页面加载过程，查看 FCP、LCP 等标记
3. **Performance Monitor**：实时监控 CPU、内存、布局等指标

```js
// 在代码中标记自定义性能点
performance.mark('my-feature-start');
// ... 执行某个操作
performance.mark('my-feature-end');
performance.measure('my-feature', 'my-feature-start', 'my-feature-end');

const measures = performance.getEntriesByName('my-feature');
console.log('耗时:', measures[0].duration.toFixed(2), 'ms');
```

## まとめ

- FCP 测量首次内容出现的时间，反映初始加载速度
- LCP 测量最大内容元素的绘制时间，更接近用户感知
- FID 测量首次交互的延迟，反映页面响应性
- CLS 测量布局偏移的累积程度，反映视觉稳定性
- 长任务拆分、图片尺寸预设、字体优化是常见的性能手段
- `web-vitals` 库可以方便地收集和上报所有核心指标
- DevTools 的 Performance 面板和 Lighthouse 是调试性能的主要工具
