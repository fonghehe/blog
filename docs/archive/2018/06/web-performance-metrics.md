---
title: "前端性能指标：FCP、TTI、FID 是什么"
date: 2018-06-23 15:02:42
tags:
  - 性能优化
readingTime: 2
description: "最近在做性能优化，发现很多人（包括我自己）对性能指标的理解比较模糊。整理一下常用的指标含义。"
---

最近在做性能优化，发现很多人（包括我自己）对性能指标的理解比较模糊。整理一下常用的指标含义。

## 核心指标

### FP（First Paint）首次绘制

浏览器第一次渲染任何像素的时间。可能只是一个背景色，用户感知不强。

### FCP（First Contentful Paint）首次内容绘制

第一次渲染文字、图片、SVG 或非白色 canvas 的时间。用户第一次看到"有内容"的时刻。

**目标**：< 1.8 秒（Google 标准）

### LCP（Largest Contentful Paint）最大内容绘制

视口内最大的文字或图片块完成渲染的时间。代表主要内容加载完成。

**目标**：< 2.5 秒

### TTI（Time to Interactive）可交互时间

页面完全可以响应用户操作的时间（主线程空闲，事件处理器已绑定）。

**目标**：< 3.8 秒

### FID（First Input Delay）首次输入延迟

用户第一次与页面交互（点击、输入）到浏览器实际开始处理的延迟时间。

**目标**：< 100ms

### CLS（Cumulative Layout Shift）累积布局偏移

页面加载过程中意外的布局偏移总量。图片没有指定宽高、动态插入内容会导致高 CLS。

**目标**：< 0.1

## 如何测量

### Chrome DevTools

```
Performance 面板 → 录制 → 查看 Timings 部分
```

### Lighthouse

```bash
npm install -g lighthouse
lighthouse https://example.com --output html --output-path report.html
```

### Performance API（代码中测量）

```javascript
// 监听 FCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      console.log("FCP:", entry.startTime, "ms");
    }
  }
});
observer.observe({ entryTypes: ["paint"] });

// 获取导航时间（TTFB 等）
const timing = performance.getEntriesByType("navigation")[0];
console.log("TTFB:", timing.responseStart - timing.fetchStart);
console.log("DOM Ready:", timing.domContentLoadedEventEnd - timing.fetchStart);
console.log("Page Load:", timing.loadEventEnd - timing.fetchStart);
```

## 常见问题与优化方向

| 指标差 | 可能原因                | 优化方向                        |
| 
------ | ----------------------- | ------------------------------- |
| FCP 慢 | JS 阻塞渲染、字体加载慢 | 减少阻塞资源、内联关键 CSS      |
| LCP 慢 | 大图、服务器慢          | 图片优化、CDN、preload 关键图片 |
| TTI 慢 | JS 过多、主线程繁忙     | 代码分割、减少 JS               |
| FID 高 | 长任务阻塞主线程        | 拆分长任务、延迟非关键 JS       |
| CLS 高 | 图片无尺寸、广告插入    | 给所有图片/视频指定宽高         |

## 小结

- FCP：用户看到内容的时刻（< 1.8s）
- LCP：主要内容加载完成（< 2.5s）
- TTI：页面真正可交互的时刻（< 3.8s）
- FID：第一次点击的响应延迟（< 100ms）
- CLS：布局稳定性（< 0.1）
- 用 Lighthouse 定期跑分，发现问题
