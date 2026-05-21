---
title: "フロントエンド監視の進化：エラー報告から全チェーン可観測性へ"
date: 2023-06-05 10:05:29
tags:
  - フロントエンド
readingTime: 2
description: "前端监控不只是\"报个错\"。随着项目复杂度增长，我们需要的是一个完整的可观测性体系。"
wordCount: 208
---

前端监控不只是"报个错"。随着项目复杂度增长，我们需要的是一个完整的可观测性体系。

## 監視の3つのレベル

```
L1: 错误监控（Error Tracking）
    - JS 运行时错误
    - Promise rejection
    - 资源加载失败
    - 接口异常

L2: 性能监控（Performance Monitoring）
    - Web Vitals（LCP, FID, CLS, INP, FCP, TTFB）
    - 自定义业务指标
    - 资源加载瀑布图

L3: 用户行为追踪（User Analytics）
    - 页面访问路径
    - 点击热力图
    - 用户操作序列（Session Replay）
```

大部分团队只做了 L1。L2 和 L3 才是真正能驱动优化的。

## Web Vitals の収集

```typescript
import { onLCP, onINP, onCLS, onFCP, onTTFB } from "web-vitals";

interface MetricEntry {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
}

function sendMetric(metric: MetricEntry) {
  // 用 Beacon API 发送，不阻塞页面卸载
  navigator.sendBeacon(
    "/api/metrics",
    JSON.stringify({
      ...metric,
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
  );
}

onCLS(sendMetric);
onINP(sendMetric);
onFCP(sendMetric);
onLCP(sendMetric);
onTTFB(sendMetric);
```

## エラーバウンダリとエラーキャッチ

```typescript
// 全局错误捕获
window.addEventListener("error", (event) => {
  if (event.target instanceof HTMLScriptElement ||
      event.target instanceof HTMLImageElement) {
    // 资源加载错误
    reportError({
      type: "resource",
      source: event.target.src || event.target.href,
      tagName: event.target.tagName,
    });
    return;
  }

  // JS 运行时错误
  reportError({
    type: "runtime",
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  reportError({
    type: "promise",
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
  });
});
```

## React Error Boundary

```typescript
import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  errorId: string | null;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, errorId: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = reportError({
      type: "react",
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    this.setState({ errorId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>出了点问题</h2>
          <p>错误编号：{this.state.errorId}</p>
          <button onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## カスタムビジネス指標

```typescript
// 首次可交互时间
const fidObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === "first-input") {
      reportMetric({
        name: "FID",
        value: entry.processingStart - entry.startTime,
      });
    }
  }
});
fidObserver.observe({ type: "first-input", buffered: true });

// 自定义指标：首屏列表渲染完成
const listRenderStart = performance.now();
// ... 组件渲染逻辑
const listRenderEnd = performance.now();
reportMetric({
  name: "list-render-time",
  value: listRenderEnd - listRenderStart,
});
```

## データ集計とアラート

```typescript
// 后端聚合逻辑（简化）
interface MetricSummary {
  page: string;
  p50: number;
  p90: number;
  p99: number;
  errorRate: number;
  sampleSize: number;
}

function aggregateMetrics(metrics: RawMetric[]): MetricSummary[] {
  return Object.entries(groupBy(metrics, "page")).map(
    ([page, entries]) => {
      const values = entries.map((e) => e.value).sort((a, b) => a - b);
      return {
        page,
        p50: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        p99: percentile(values, 0.99),
        errorRate: entries.filter((e) => e.rating === "poor").length / values.length,
        sampleSize: values.length,
      };
    }
  );
}
```

## まとめ

- 前端监控应覆盖错误、性能、用户行为三个层次
- Web Vitals 是性能监控的标准化基础，必采
- 错误捕获要覆盖运行时错误、Promise rejection、资源加载、React 渲染
- 自定义业务指标让监控更贴近产品价值
- 聚合分析比单条错误日志更重要——看趋势、看 P99