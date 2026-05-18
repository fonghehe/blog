---
title: "前端監控體系演進：從錯誤上報到全鏈路可觀測"
date: 2023-06-05 10:05:29
tags:
  - 前端
readingTime: 2
description: "前端監控不只是\"報個錯\"。隨著專案複雜度增長，我們需要的是一個完整的可觀測性體系。"
---

前端監控不只是"報個錯"。隨著專案複雜度增長，我們需要的是一個完整的可觀測性體系。

## 監控的三個層次

```
L1: 錯誤監控（Error Tracking）
    - JS 執行時錯誤
    - Promise rejection
    - 資源載入失敗
    - 介面異常

L2: 效能監控（Performance Monitoring）
    - Web Vitals（LCP, FID, CLS, INP, FCP, TTFB）
    - 自定義業務指標
    - 資源載入瀑布圖

L3: 使用者行為追蹤（User Analytics）
    - 頁面訪問路徑
    - 點選熱力圖
    - 使用者操作序列（Session Replay）
```

大部分團隊只做了 L1。L2 和 L3 才是真正能驅動最佳化的。

## Web Vitals 採集

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
  // 用 Beacon API 傳送，不阻塞頁面解除安裝
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

## 錯誤邊界和錯誤捕獲

```typescript
// 全域性錯誤捕獲
window.addEventListener("error", (event) => {
  if (event.target instanceof HTMLScriptElement ||
      event.target instanceof HTMLImageElement) {
    // 資源載入錯誤
    reportError({
      type: "resource",
      source: event.target.src || event.target.href,
      tagName: event.target.tagName,
    });
    return;
  }

  // JS 執行時錯誤
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
          <h2>出了點問題</h2>
          <p>錯誤編號：{this.state.errorId}</p>
          <button onClick={() => window.location.reload()}>
            重新整理頁面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## 自定義業務指標

```typescript
// 首次可互動時間
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

// 自定義指標：首屏列表渲染完成
const listRenderStart = performance.now();
// ... 元件渲染邏輯
const listRenderEnd = performance.now();
reportMetric({
  name: "list-render-time",
  value: listRenderEnd - listRenderStart,
});
```

## 資料聚合和告警

```typescript
// 後端聚合邏輯（簡化）
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

## 小結

- 前端監控應覆蓋錯誤、效能、使用者行為三個層次
- Web Vitals 是效能監控的標準化基礎，必採
- 錯誤捕獲要覆蓋執行時錯誤、Promise rejection、資源載入、React 渲染
- 自定義業務指標讓監控更貼近產品價值
- 聚合分析比單條錯誤日誌更重要——看趨勢、看 P99