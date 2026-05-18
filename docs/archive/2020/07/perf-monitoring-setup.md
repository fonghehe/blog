---
title: "前端性能监控体系搭建"
date: 2020-07-21 09:55:46
tags:
  - 性能优化
readingTime: 2
description: "上线后用户反馈\"页面很慢\"，但我们没有任何数据佐证。搭建了一套前端性能监控体系，终于能用数据说话了。"
---

上线后用户反馈"页面很慢"，但我们没有任何数据佐证。搭建了一套前端性能监控体系，终于能用数据说话了。

## 核心指标

```javascript
// Web Vitals 三大核心指标（Google 2020 年提出）
// LCP: Largest Contentful Paint - 最大内容绘制（加载速度）
// FID: First Input Delay - 首次输入延迟（交互响应）
// CLS: Cumulative Layout Shift - 累积布局偏移（视觉稳定性）

// 目标值
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },    // ms
  FID: { good: 100, poor: 300 },      // ms
  CLS: { good: 0.1, poor: 0.25 },     // 分数
};
```

## 采集性能数据

```javascript
// utils/performance.js
export class PerformanceMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/perf';
    this.appId = options.appId;
    this.userId = options.userId;
  }

  // 采集 Navigation Timing
  getNavigationTiming() {
    const timing = performance.getEntriesByType('navigation')[0];
    if (!timing) return null;

    return {
      // DNS 解析
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      // TCP 连接
      tcp: timing.connectEnd - timing.connectStart,
      // 首字节时间
      ttfb: timing.responseStart - timing.requestStart,
      // DOM 解析
      domParse: timing.domInteractive - timing.responseEnd,
      // DOM Ready
      domReady: timing.domContentLoadedEventEnd - timing.startTime,
      // 页面完全加载
      load: timing.loadEventEnd - timing.startTime,
    };
  }

  // 采集 LCP
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

  // 采集 FID
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

  // 采集 CLS
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

  // 采集资源加载
  getResourceTiming() {
    const resources = performance.getEntriesByType('resource');
    return resources.map(r => ({
      name: r.name.split('/').pop(),
      type: r.initiatorType,
      size: r.transferSize,
      duration: r.duration,
    })).filter(r => r.duration > 100); // 只记录慢资源
  }

  // 上报数据
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

    // 用 sendBeacon 保证页面卸载时也能发送
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

  // 启动监控
  start() {
    // 页面加载完成后收集数据
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

    // 页面卸载时上报
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const resources = this.getResourceTiming();
        this.report({ type: 'resources', items: resources });
      }
    });
  }
}
```

## 在项目中使用

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

## 服务端接收和存储

```javascript
// server/middleware/performance.js
// 简化版：存储到 ClickHouse 或 ES
const reportHandler = async (req, res) => {
  const data = req.body;

  // 基本校验
  if (!data.appId || !data.timestamp) {
    return res.status(400).json({ error: 'invalid data' });
  }

  // 异步写入，不阻塞响应
  queue.push({
    ...data,
    receivedAt: Date.now(),
  });

  res.status(204).end();
};
```

## 监控面板

```javascript
// 简单的性能概览数据
const dashboard = {
  // 每日概览
  overview: {
    avgLCP: 1800,        // 平均 LCP
    p75LCP: 2400,        // 75 分位 LCP
    p95LCP: 3800,        // 95 分位 LCP
    avgFID: 45,
    avgCLS: 0.05,
    // 按网络类型分组
    byConnection: {
      '4g': { avgLCP: 1500 },
      '3g': { avgLCP: 3200 },
    },
    // 按页面分组
    byPage: {
      '/dashboard': { avgLCP: 1200 },
      '/user-list': { avgLCP: 2800 },
    },
  },
};

// 告警规则
const alerts = [
  { metric: 'p95LCP', threshold: 4000, condition: '>', message: 'P95 LCP 超过 4 秒' },
  { metric: 'avgFID', threshold: 200, condition: '>', message: '平均 FID 超过 200ms' },
  { metric: 'errorRate', threshold: 0.01, condition: '>', message: '错误率超过 1%' },
];
```

## 小结

- Web Vitals 三个核心指标：LCP（加载）、FID（交互）、CLS（稳定）
- 用 PerformanceObserver API 采集，sendBeacon 保证上报成功
- 按页面、网络类型、浏览器等维度分析性能数据
- 设置告警规则，性能劣化及时发现
- 性能数据是优化的前提，没有数据的优化是盲目的
