---
title: "Frontend Performance Metrics: What Are FCP, TTI, and FID?"
date: 2018-06-23 15:02:42
tags:
  - Performance Optimization
readingTime: 2
description: "I've been doing performance optimization lately and realized that many people (including myself) have a fuzzy understanding of performance metrics. Here's a sum"
wordCount: 328
---

I've been doing performance optimization lately and realized that many people (including myself) have a fuzzy understanding of performance metrics. Here's a summary of the key ones.

## Core Metrics

### FP (First Paint)

The time when the browser first renders any pixel. It might just be a background color — user perception is weak at this point.

### FCP (First Contentful Paint)

The time when text, images, SVGs, or non-white canvas are first rendered. The moment the user first sees "content."

**Target**: < 1.8 seconds (Google standard)

### LCP (Largest Contentful Paint)

The time when the largest block of text or image within the viewport completes rendering. Represents when the main content has loaded.

**Target**: < 2.5 seconds

### TTI (Time to Interactive)

The time when the page is fully able to respond to user actions (main thread is idle, event handlers are attached).

**Target**: < 3.8 seconds

### FID (First Input Delay)

The delay between the user's first interaction (click, input) and when the browser actually starts processing it.

**Target**: < 100ms

### CLS (Cumulative Layout Shift)

The total amount of unexpected layout shifts during page load. Images without specified dimensions and dynamically injected content cause high CLS.

**Target**: < 0.1

## How to Measure

### Chrome DevTools

```
Performance panel → Record → Check the Timings section
```

### Lighthouse

```bash
npm install -g lighthouse
lighthouse https://example.com --output html --output-path report.html
```

### Performance API (Measure in Code)

```javascript
// Listen for FCP
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-contentful-paint") {
      console.log("FCP:", entry.startTime, "ms");
    }
  }
});
observer.observe({ entryTypes: ["paint"] });

// Get navigation timing (TTFB, etc.)
const timing = performance.getEntriesByType("navigation")[0];
console.log("TTFB:", timing.responseStart - timing.fetchStart);
console.log("DOM Ready:", timing.domContentLoadedEventEnd - timing.fetchStart);
console.log("Page Load:", timing.loadEventEnd - timing.fetchStart);
```

## Common Issues and Optimization Directions

| Poor Metric | Possible Cause                          | Optimization Direction                           |
| ----------- | --------------------------------------- | ------------------------------------------------ |
| Slow FCP    | JS blocking render, slow font loading   | Reduce blocking resources, inline critical CSS   |
| Slow LCP    | Large images, slow server               | Image optimization, CDN, preload critical images |
| Slow TTI    | Too much JS, busy main thread           | Code splitting, reduce JS                        |
| High FID    | Long tasks blocking main thread         | Break up long tasks, defer non-critical JS       |
| High CLS    | Images without dimensions, ad injection | Specify width/height for all images/videos       |

## Summary

- FCP: when the user sees content (< 1.8s)
- LCP: when the main content finishes loading (< 2.5s)
- TTI: when the page is truly interactive (< 3.8s)
- FID: response delay on first click (< 100ms)
- CLS: layout stability (< 0.1)
- Run Lighthouse regularly to spot issues
