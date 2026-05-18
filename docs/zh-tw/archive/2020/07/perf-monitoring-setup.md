---
title: "前端效能監控體系搭建"
date: 2020-07-21 09:55:46
tags:
  - 效能最佳化
readingTime: 2
description: "上線後用戶反饋\"頁面很慢\"，但我們沒有任何資料佐證。搭建了一套前端效能監控體系，終於能用資料說話了。"
---

上線後用戶反饋"頁面很慢"，但我們沒有任何資料佐證。搭建了一套前端效能監控體系，終於能用資料說話了。

## 核心指標

```javascript
// Web Vitals 三大核心指標（Google 2020 年提出）
// LCP: Largest Contentful Paint - 最大內容繪製（載入速度）
// FID: First Input Delay - 首次輸入延遲（互動響應）
// CLS: Cumulative Layout Shift - 累積佈局偏移（視覺穩定性）

// 目標值
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },    // ms
  FID: { good: 100, poor: 300 },      // ms
  CLS: { good: 0.1, poor: 0.25 },     // 分數
};
```

## 採集效能資料

```javascript
// utils/performance.js
export class PerformanceMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/perf';
    this.appId = options.appId;
    this.userId = options.userId;
  }

  // 採集 Navigation Timing
  getNavigationTiming() {
    const timing = performance.getEntriesByType('navigation')[0];
    if (!timing) return null;

    return {
      // DNS 解析
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      // TCP 連線
      tcp: timing.connectEnd - timing.connectStart,
      // 首位元組時間
      ttfb: timing.responseStart - timing.requestStart,
      // DOM 解析
      domParse: timing.domInteractive - timing.responseEnd,
      // DOM Ready
      domReady: timing.domContentLoadedEventEnd - timing.startTime,
      // 頁面完全載入
      load: timing.loadEventEnd - timing.startTime,
    };
  }

  // 採集 LCP
  observeLCP(callback) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      callback({
        value: lastEntry.startTime,
        element: lastEntry.element?.tagName,
        url: lastEntry.url,
      });
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  }

  // 採集 FID
  observeFID(callback) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        callback({
          value: entry.processingStart - entry.startTime,
          eventType: entry.name,
        });
      });
    });
    observer.observe({ type: 'first-input', buffered: true });
  }

  // 採集 CLS
  observeCLS(callback) {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      callback({ value: clsValue });
    });
    observer.observe({ type: 'layout-shift', buffered: true });
  }

  // 採集資源載入
  getResourceTiming() {
    const resources = performance.getEntriesByType('resource');
    return resources.map(r => ({
      name: r.name.split('/').pop(),
      type: r.initiatorType,
      size: r.transferSize,
      duration: r.duration,
    })).filter(r => r.duration > 100); // 只記錄慢資源
  }

  // 上報資料
  report(data) {
    const payload = {
      ...data,
      appId: this.appId,
      userId: this.userId,
      url: location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      connection: navigator.connection
        ? { effectiveType: navigator.connection.effectiveType }
        : null,
    };

    // 用 sendBeacon 保證頁面解除安裝時也能傳送
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
    } else {
      fetch(this.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
      });
    }
  }

  // 啟動監控
  start() {
    // 頁面載入完成後收集資料
    window.addEventListener('load', () => {
      setTimeout(() => {
        const nav = this.getNavigationTiming();
        this.report({
          type: 'navigation',
          ...nav,
        });
      }, 0);
    });

    this.observeLCP(data => {
      this.report({ type: 'LCP', ...data });
    });

    this.observeFID(data => {
      this.report({ type: 'FID', ...data });
    });

    this.observeCLS(data => {
      this.report({ type: 'CLS', ...data });
    });

    // 頁面解除安裝時上報
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const resources = this.getResourceTiming();
        this.report({ type: 'resources', items: resources });
      }
    });
  }
}
```

## 在專案中使用

```javascript
// main.js
import { PerformanceMonitor } from '@/utils/performance';

const monitor = new PerformanceMonitor({
  endpoint: '/api/v1/performance',
  appId: 'admin-portal',
  userId: getCurrentUserId(),
});

monitor.start();
```

## 服務端接收和儲存

```javascript
// server/middleware/performance.js
// 簡化版：儲存到 ClickHouse 或 ES
const reportHandler = async (req, res) => {
  const data = req.body;

  // 基本校驗
  if (!data.appId || !data.timestamp) {
    return res.status(400).json({ error: 'invalid data' });
  }

  // 非同步寫入，不阻塞響應
  queue.push({
    ...data,
    receivedAt: Date.now(),
  });

  res.status(204).end();
};
```

## 監控面板

```javascript
// 簡單的效能概覽資料
const dashboard = {
  // 每日概覽
  overview: {
    avgLCP: 1800,        // 平均 LCP
    p75LCP: 2400,        // 75 分位 LCP
    p95LCP: 3800,        // 95 分位 LCP
    avgFID: 45,
    avgCLS: 0.05,
    // 按網路型別分組
    byConnection: {
      '4g': { avgLCP: 1500 },
      '3g': { avgLCP: 3200 },
    },
    // 按頁面分組
    byPage: {
      '/dashboard': { avgLCP: 1200 },
      '/user-list': { avgLCP: 2800 },
    },
  },
};

// 告警規則
const alerts = [
  { metric: 'p95LCP', threshold: 4000, condition: '>', message: 'P95 LCP 超過 4 秒' },
  { metric: 'avgFID', threshold: 200, condition: '>', message: '平均 FID 超過 200ms' },
  { metric: 'errorRate', threshold: 0.01, condition: '>', message: '錯誤率超過 1%' },
];
```

## 小結

- Web Vitals 三個核心指標：LCP（載入）、FID（互動）、CLS（穩定）
- 用 PerformanceObserver API 採集，sendBeacon 保證上報成功
- 按頁面、網路型別、瀏覽器等維度分析效能資料
- 設定告警規則，效能劣化及時發現
- 效能資料是最佳化的前提，沒有資料的最佳化是盲目的
