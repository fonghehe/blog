---
title: "前端性能监控实践"
date: 2018-09-30 10:45:26
tags:
  - 性能优化
readingTime: 1
description: "做了一段时间性能优化，但一直没有系统地监控线上性能。研究了一下如何把性能数据收集起来。"
---

做了一段时间性能优化，但一直没有系统地监控线上性能。研究了一下如何把性能数据收集起来。

## 为什么需要线上监控

```
DevTools 测的是你本机的情况
真实用户可能在：
  - 2G/3G 网络
  - 低端安卓手机
  - 网络不稳定的地区

线上监控才能知道真实用户的体验
```

## Performance API

浏览器内置的性能时间戳：

```javascript
// 获取各阶段时间
const timing = performance.timing;

// 常用指标计算
const metrics = {
  // DNS 解析时间
  dns: timing.domainLookupEnd - timing.domainLookupStart,
  // TCP 连接时间
  tcp: timing.connectEnd - timing.connectStart,
  // 首字节时间（TTFB）
  ttfb: timing.responseStart - timing.requestStart,
  // 页面完全加载时间
  load: timing.loadEventEnd - timing.navigationStart,
  // DOM 解析时间
  domParse: timing.domInteractive - timing.responseEnd,
  // 白屏时间（近似值）
  whiteScreen: timing.domLoading - timing.navigationStart,
};

console.log(metrics);
```

## 使用 PerformanceObserver

```javascript
// 监听 LCP（最大内容绘制）
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log("LCP:", lastEntry.startTime);
  reportMetric("lcp", lastEntry.startTime);
});
lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

// 监听 FID（首次输入延迟）
const fidObserver = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log("FID:", entry.processingStart - entry.startTime);
  reportMetric("fid", entry.processingStart - entry.startTime);
});
fidObserver.observe({ entryTypes: ["first-input"] });

// 监听 CLS（累积布局位移）
let clsScore = 0;
const clsObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) {
      clsScore += entry.value;
    }
  });
});
clsObserver.observe({ entryTypes: ["layout-shift"] });

// 页面离开时上报 CLS
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    reportMetric("cls", clsScore);
  }
});
```

## 资源加载监控

```javascript
// 获取所有资源的加载时间
const resources = performance.getEntriesByType("resource");
resources.forEach((resource) => {
  if (resource.duration > 1000) {
    // 超过 1s 的资源记录下来
    console.warn("慢资源:", resource.name, resource.duration + "ms");
  }
});
```

## 上报到后端

```javascript
function reportMetric(name, value) {
  // 用 sendBeacon 上报（不阻塞页面卸载，比 fetch 更可靠）
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

## 实际上线后的问题

上了监控之后发现：

```
- 移动端用户的 LCP 比桌面端慢 3 倍
- 某个城市的 TTFB 特别高（CDN 节点问题）
- 一个第三方广告脚本让 CLS 爆表
```

没有数据的时候，这些问题永远发现不了。

## 小结

- `performance.timing`：各阶段时间戳（TTFB、DNS、TCP 等）
- `PerformanceObserver`：监听 LCP、FID、CLS 等指标
- `navigator.sendBeacon`：页面卸载时可靠上报数据
- 线上监控是发现真实性能问题的唯一方式，本机 DevTools 不够