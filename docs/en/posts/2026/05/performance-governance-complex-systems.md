---
title: "Performance Governance in Complex Systems: RUM, Budgets & Automated Regression Detection"
date: 2026-05-15 09:43:12
tags:
  - Performance
  - Engineering
readingTime: 3
description: "When your application is a back-office system with 50+ pages, 100+ charts, and real-time data stream refreshes, performance problems are no longer \"one slow pag"
wordCount: 279
---

When your application is a back-office system with 50+ pages, 100+ charts, and real-time data stream refreshes, performance problems are no longer "one slow page." It is an engineering problem requiring continuous investment and systematic governance. This article discusses how to establish performance baselines with RUM (Real User Monitoring), how to design and enforce performance budgets, how to automatically detect performance regressions in CI, and how to optimize heavy dashboard UIs.

## RUM: Measuring Performance from the Real User's Perspective

### Why Lab Data Is Not Enough

The data from Lighthouse and WebPageTest is **lab data** — fixed network speed, fixed device, empty cache. But real users look like:

- 30% of users are on 3G/4G weak network
- 15% of users have devices with < 4GB RAM
- Users may have warm cache (return visits) or be first-time visitors
- CDN coverage varies by region

Lab data is for **diagnosis**; RUM data is for **decisions**.

### RUM Collection Architecture

```typescript
// rum/collector.ts
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from "web-vitals";

interface RUMPayload {
  metrics: MetricEntry[];
  context: PageContext;
}

interface MetricEntry {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  navigationType: string;
}

interface PageContext {
  url: string;
  route: string; // route pattern, e.g. /dashboard/:id
  userAgent: string;
  connectionType: string; // 4g, 3g, wifi
  deviceMemory: number;
  timestamp: number;
}

const metricsBuffer: MetricEntry[] = [];

function collectMetric(metric: Metric) {
  metricsBuffer.push({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType || "navigate",
  });
}

// Register all Web Vitals
onLCP(collectMetric);
onINP(collectMetric);
onCLS(collectMetric);
onFCP(collectMetric);
onTTFB(collectMetric);

// Batch-send on page leave
function flushMetrics() {
  if (metricsBuffer.length === 0) return;
  const blob = new Blob(
    [JSON.stringify({ metrics: metricsBuffer, context: getPageContext() })],
    {
      type: "application/json",
    },
  );
  navigator.sendBeacon("/api/rum/collect", blob);
  metricsBuffer.length = 0;
}

// visibilitychange is more reliable than unload
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushMetrics();
});
```

### RUM Data Analysis Dimensions

```sql
-- P75 LCP by route
SELECT
  route,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75_lcp,
  COUNT(*) as sample_count
FROM rum_metrics
WHERE name = 'LCP'
  AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY route
HAVING COUNT(*) > 100
ORDER BY p75_lcp DESC;

-- Performance gap by connection type
SELECT
  connection_type,
  AVG(CASE WHEN name = 'LCP' THEN value END) as avg_lcp,
  AVG(CASE WHEN name = 'INP' THEN value END) as avg_inp,
  COUNT(DISTINCT session_id) as users
FROM rum_metrics
JOIN rum_context USING (session_id)
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY connection_type;
```

### Establishing Baselines and Alerts

```typescript
interface PerformanceAlert {
  metric: "LCP" | "INP" | "CLS";
  route: string;
  threshold: number; // P75 value
  window: "1h" | "24h" | "7d";
  action: "slack" | "pagerduty";
}

const ALERT_RULES: PerformanceAlert[] = [
  { metric: "LCP", route: "/", threshold: 3000, window: "1h", action: "slack" },
  {
    metric: "INP",
    route: "/dashboard/*",
    threshold: 300,
    window: "1h",
    action: "slack",
  },
  {
    metric: "CLS",
    route: "*",
    threshold: 0.25,
    window: "1h",
    action: "pagerduty",
  },
];
```

## Performance Budgets: From Goals to Enforcement

### Designing a Budget

A performance budget is not a number pulled from thin air — it's reverse-engineered from **user experience goals**:

```
User experience goals:
  LCP < 2.5s (P75)
  INP < 200ms (P75)

Reverse-engineering technical constraints:
  → First-paint JS < 150KB (gzipped)
     Rationale: 150KB download on 3G ≈ 1.5s, parse/exec ≈ 0.5s, + TTFB ≈ 0.5s = 2.5s
  → First-paint CSS < 50KB (gzipped)
  → Critical images < 200KB
  → Main thread single task < 50ms
     Rationale: INP = input delay + processing + presentation;
                processing < 50ms ensures total < 200ms
```

### CI Budget Enforcement

```typescript
// Lighthouse CI budget check
export const budgets = [
  {
    path: "/*",
    resourceSizes: [
      { resourceType: "script", budget: 150 },
      { resourceType: "stylesheet", budget: 50 },
    ],
    timings: [
      { metric: "largest-contentful-paint", budget: 2500 },
      { metric: "cumulative-layout-shift", budget: 0.1 },
    ],
  },
];
```

## Dashboard Optimization: The Hardest Scenario

Dashboard-class UIs are the most challenging performance scenario — 100+ charts + real-time data streaming push all the bottlenecks at once:

```typescript
// Strategy 1: Viewport-based lazy rendering
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const chartId = entry.target.getAttribute("data-chart-id");
        if (chartId) renderChart(chartId);
        observer.unobserve(entry.target);
      }
    });
  },
  { rootMargin: "200px" }, // start rendering 200px before entering viewport
);

// Strategy 2: Data update throttling (don't re-render on every tick)
const throttledUpdate = useThrottleFn((newData: ChartData) => {
  chartData.value = newData;
}, 1000); // at most 1 update per second

// Strategy 3: Web Worker for heavy computation
const worker = new Worker(
  new URL("./chart-processor.worker.ts", import.meta.url),
);
worker.postMessage({ rawData, config });
worker.onmessage = (e) => {
  processedData.value = e.data;
};
```

## Summary

Performance governance for complex systems requires three layers working together: **RUM** to understand real-world user experience, **performance budgets** to encode that understanding into enforceable CI constraints, and **dashboard-specific optimizations** (lazy rendering, data throttling, Web Workers) to handle the hardest runtime scenarios. When all three layers are in place, performance becomes a property of the system rather than a heroic one-off effort.
