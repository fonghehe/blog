---
title: "Frontend Performance Monitoring in Practice"
date: 2018-09-30 10:45:26
tags:
  - Performance Optimization
readingTime: 1
description: "I've been doing performance optimization for a while but never systematically monitored production performance. Here's how to collect performance data."
---

I've been doing performance optimization for a while but never systematically monitored production performance. Here's how to collect performance data.

## Why You Need Production Monitoring

```
DevTools shows you performance on your machine.
Real users might be on:
  - 2G/3G networks
  - Low-end Android phones
  - Areas with unstable connectivity

Only production monitoring reveals what real users actually experience.
```

## The Performance API

Browser-built-in performance timestamps:

```javascript
// Get timing for each phase
const timing = performance.timing;

// Common metric calculations
const metrics = {
  // DNS resolution time
  dns: timing.domainLookupEnd - timing.domainLookupStart,
  // TCP connection time
  tcp: timing.connectEnd - timing.connectStart,
  // Time to First Byte (TTFB)
  ttfb: timing.responseStart - timing.requestStart,
  // Full page load time
  load: timing.loadEventEnd - timing.navigationStart,
  // DOM parsing time
  domParse: timing.domInteractive - timing.responseEnd,
  // White screen time (approximate)
  whiteScreen: timing.domLoading - timing.navigationStart,
};

console.log(metrics);
```

## Using PerformanceObserver

```javascript
// Monitor LCP (Largest Contentful Paint)
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log("LCP:", lastEntry.startTime);
  reportMetric("lcp", lastEntry.startTime);
});
lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

// Monitor FID (First Input Delay)
const fidObserver = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log("FID:", entry.processingStart - entry.startTime);
  reportMetric("fid", entry.processingStart - entry.startTime);
});
fidObserver.observe({ entryTypes: ["first-input"] });

// Monitor CLS (Cumulative Layout Shift)
let clsScore = 0;
const clsObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) {
      clsScore += entry.value;
    }
  });
});
clsObserver.observe({ entryTypes: ["layout-shift"] });

// Report CLS when the page is hidden
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    reportMetric("cls", clsScore);
  }
});
```

## Resource Load Monitoring

```javascript
// Get load times for all resources
const resources = performance.getEntriesByType("resource");
resources.forEach((resource) => {
  if (resource.duration > 1000) {
    // Record resources that took more than 1s
    console.warn("Slow resource:", resource.name, resource.duration + "ms");
  }
});
```

## Reporting to the Backend

```javascript
function reportMetric(name, value) {
  // Use sendBeacon to report (doesn't block page unload, more reliable than fetch)
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

## What We Found After Going Live

After adding monitoring, we discovered:

```
- Mobile users' LCP was 3x slower than desktop
- TTFB was unusually high in certain regions (CDN node issue)
- A third-party ad script was causing CLS to spike
```

These issues would never have been found without data.

## Summary

- `performance.timing`: timestamps for each phase (TTFB, DNS, TCP, etc.)
- `PerformanceObserver`: monitor LCP, FID, CLS and other metrics
- `navigator.sendBeacon`: reliably report data during page unload
- Production monitoring is the only way to discover real performance issues — DevTools isn't enough
