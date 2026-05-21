---
title: "复杂系统的性能治理：RUM、性能预算与自动化回归检测"
date: 2026-05-15 09:43:12
tags:
  - 性能优化
  - 性能
  - 工程化
readingTime: 8
description: '当你的应用是一个包含 50+ 个页面、100+ 个图表、实时数据流刷新的中后台系统时，性能问题不再是"某个页面慢"这么简单。它是一个需要持续投入、系统性治理的工程问题。本文讨论如何用 RUM（真实用户监控）建立性能基线，如何设计和执行性能预算，如何在 CI 中自动检测性能回归，以及如何优化 Dashboard 类重度 '
wordCount: 815
---

当你的应用是一个包含 50+ 个页面、100+ 个图表、实时数据流刷新的中后台系统时，性能问题不再是"某个页面慢"这么简单。它是一个需要持续投入、系统性治理的工程问题。本文讨论如何用 RUM（真实用户监控）建立性能基线，如何设计和执行性能预算，如何在 CI 中自动检测性能回归，以及如何优化 Dashboard 类重度 UI 系统。

## RUM：真实用户视角的性能度量

### 为什么 Lab 数据不够

Lighthouse 和 WebPageTest 跑出来的数据是**实验室数据**——固定网速、固定设备、空缓存。但真实用户的情况是：

- 30% 的用户在 3G/4G 弱网环境
- 15% 的用户设备 RAM < 4GB
- 用户可能已有缓存（回访），也可能是首次访问
- 某些地区的 CDN 节点覆盖不佳

Lab 数据用于**诊断**，RUM 数据用于**决策**。

### RUM 采集架构

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
  route: string; // 路由模式，如 /dashboard/:id
  userAgent: string;
  connectionType: string; // 4g, 3g, wifi
  deviceMemory: number;
  timestamp: number;
}

function getPageContext(): PageContext {
  const nav = navigator as any;
  return {
    url: location.href,
    route: getCurrentRoutePattern(), // 从 router 获取
    userAgent: navigator.userAgent,
    connectionType: nav.connection?.effectiveType || "unknown",
    deviceMemory: nav.deviceMemory || 0,
    timestamp: Date.now(),
  };
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

// 注册所有 Web Vitals 采集
onLCP(collectMetric);
onINP(collectMetric);
onCLS(collectMetric);
onFCP(collectMetric);
onTTFB(collectMetric);

// 页面离开时批量上报
function flushMetrics() {
  if (metricsBuffer.length === 0) return;

  const payload: RUMPayload = {
    metrics: [...metricsBuffer],
    context: getPageContext(),
  };

  // 使用 sendBeacon 确保页面关闭时也能发送
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  navigator.sendBeacon("/api/rum/collect", blob);

  metricsBuffer.length = 0;
}

// 页面隐藏时上报（比 unload 更可靠）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushMetrics();
  }
});
```

### RUM 数据的分析维度

收集到的 RUM 数据需要按多个维度聚合才有价值：

```sql
-- 按路由分析 P75 LCP
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

-- 按网络类型分析性能差异
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

### 建立性能基线和告警

```typescript
// 性能告警规则
interface PerformanceAlert {
  metric: "LCP" | "INP" | "CLS";
  route: string;
  threshold: number; // P75 值
  window: "1h" | "24h" | "7d";
  action: "slack" | "pagerduty";
}

const ALERT_RULES: PerformanceAlert[] = [
  // 首页 LCP P75 超过 3s 触发告警
  { metric: "LCP", route: "/", threshold: 3000, window: "1h", action: "slack" },
  // Dashboard INP P75 超过 300ms 触发告警
  {
    metric: "INP",
    route: "/dashboard/*",
    threshold: 300,
    window: "1h",
    action: "slack",
  },
  // 任何页面 CLS 超过 0.25 紧急告警
  {
    metric: "CLS",
    route: "*",
    threshold: 0.25,
    window: "1h",
    action: "pagerduty",
  },
];
```

## 性能预算：从目标到执行

### 设计性能预算

性能预算不是拍脑袋定一个数字，而是基于**用户体验目标**倒推：

```
用户体验目标：
  LCP < 2.5s (P75)
  INP < 200ms (P75)

倒推技术约束：
  → 首屏 JS < 150KB (gzipped)
     理由：3G 网络下载 150KB ≈ 1.5s，解析执行 ≈ 0.5s，加 TTFB ≈ 0.5s = 2.5s
  → 首屏 CSS < 50KB (gzipped)
  → 首屏关键图片 < 200KB
  → 主线程单任务 < 50ms
     理由：INP = input delay + processing + presentation，processing < 50ms 才能保证总和 < 200ms
```

### 预算的分配策略

```typescript
// performance-budget.config.ts
export interface BudgetConfig {
  // 按资源类型分配
  resourceBudgets: {
    js: { total: number; perRoute: number };
    css: { total: number; perRoute: number };
    images: { perPage: number };
    fonts: { total: number };
  };
  // 按路由分配
  routeBudgets: Record<
    string,
    {
      lcp: number;
      inp: number;
      cls: number;
      totalJsSize: number;
    }
  >;
}

export const budgetConfig: BudgetConfig = {
  resourceBudgets: {
    js: { total: 300 * 1024, perRoute: 80 * 1024 }, // 300KB total, 80KB per route
    css: { total: 80 * 1024, perRoute: 30 * 1024 },
    images: { perPage: 500 * 1024 },
    fonts: { total: 100 * 1024 },
  },
  routeBudgets: {
    "/": { lcp: 2000, inp: 150, cls: 0.05, totalJsSize: 120 * 1024 },
    "/dashboard": { lcp: 3000, inp: 200, cls: 0.1, totalJsSize: 200 * 1024 },
    "/reports": { lcp: 3500, inp: 250, cls: 0.1, totalJsSize: 250 * 1024 },
  },
};
```

### 预算执行机制

预算如果只是写在文档里等于没有。必须集成到工程流程中：

```typescript
// scripts/check-performance-budget.ts
import { budgetConfig } from "../performance-budget.config";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { gzipSync } from "zlib";

interface BudgetViolation {
  type: "js" | "css" | "total";
  file: string;
  actual: number;
  budget: number;
  severity: "warning" | "error";
}

function checkBuildOutput(distDir: string): BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  const assets = collectAssets(distDir);

  // 检查总 JS 体积
  const totalJs = assets
    .filter((a) => a.name.endsWith(".js"))
    .reduce((sum, a) => sum + a.gzipSize, 0);

  if (totalJs > budgetConfig.resourceBudgets.js.total) {
    violations.push({
      type: "js",
      file: "total",
      actual: totalJs,
      budget: budgetConfig.resourceBudgets.js.total,
      severity: "error",
    });
  }

  // 检查单个路由 chunk 体积
  assets
    .filter((a) => a.name.endsWith(".js") && !a.name.includes("vendor"))
    .forEach((asset) => {
      if (asset.gzipSize > budgetConfig.resourceBudgets.js.perRoute) {
        violations.push({
          type: "js",
          file: asset.name,
          actual: asset.gzipSize,
          budget: budgetConfig.resourceBudgets.js.perRoute,
          severity:
            asset.gzipSize > budgetConfig.resourceBudgets.js.perRoute * 1.5
              ? "error"
              : "warning",
        });
      }
    });

  return violations;
}

function collectAssets(dir: string) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
    .map((name) => {
      const content = readFileSync(path.join(dir, name));
      return {
        name,
        rawSize: content.length,
        gzipSize: gzipSync(content).length,
      };
    });
}

// CI 集成
const violations = checkBuildOutput("./dist");
if (violations.some((v) => v.severity === "error")) {
  console.error("❌ Performance budget exceeded:");
  violations.forEach((v) => {
    const icon = v.severity === "error" ? "❌" : "⚠️";
    console.error(
      `  ${icon} ${v.file}: ${(v.actual / 1024).toFixed(1)}KB > ${(v.budget / 1024).toFixed(1)}KB`,
    );
  });
  process.exit(1);
}
```

## 自动化性能回归检测

### Lab 环境的回归检测

在 CI 中运行 Lighthouse CI，对比 PR 前后的性能变化：

```yaml
# .github/workflows/performance.yml
name: Performance Regression Check
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm build
      - run: pnpm preview &

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true
```

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:4173/",
        "http://localhost:4173/dashboard/",
        "http://localhost:4173/reports/"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.85 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 3000 }],
        "interactive": ["error", { "maxNumericValue": 5000 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["warning", { "maxNumericValue": 500000 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### RUM 数据的回归检测

Lab 检测只能发现明显的回归。更精确的方法是对比**发布前后的 RUM P75**：

```typescript
// scripts/rum-regression-check.ts
interface ReleaseComparison {
  metric: string;
  route: string;
  before: { p75: number; sampleCount: number };
  after: { p75: number; sampleCount: number };
  delta: number; // 绝对变化
  deltaPercent: number; // 百分比变化
  isRegression: boolean;
}

async function checkRUMRegression(
  releaseTag: string,
  lookbackHours: number = 24,
): Promise<ReleaseComparison[]> {
  const releaseTime = await getReleaseTimestamp(releaseTag);
  const comparisons: ReleaseComparison[] = [];

  const metrics = ["LCP", "INP", "CLS"];
  const routes = ["/", "/dashboard", "/reports"];

  for (const metric of metrics) {
    for (const route of routes) {
      const before = await queryP75(metric, route, {
        from: releaseTime - lookbackHours * 3600 * 1000,
        to: releaseTime,
      });
      const after = await queryP75(metric, route, {
        from: releaseTime,
        to: releaseTime + lookbackHours * 3600 * 1000,
      });

      if (before.sampleCount < 50 || after.sampleCount < 50) continue;

      const delta = after.p75 - before.p75;
      const deltaPercent = (delta / before.p75) * 100;

      comparisons.push({
        metric,
        route,
        before,
        after,
        delta,
        deltaPercent,
        // 回归判定：P75 恶化超过 10% 且绝对值超过阈值
        isRegression:
          deltaPercent > 10 && exceedsAbsoluteThreshold(metric, delta),
      });
    }
  }

  return comparisons;
}

function exceedsAbsoluteThreshold(metric: string, delta: number): boolean {
  const thresholds: Record<string, number> = {
    LCP: 200, // 200ms
    INP: 30, // 30ms
    CLS: 0.02, // 0.02
  };
  return delta > (thresholds[metric] || 0);
}
```

### 自动回滚机制

当检测到严重性能回归时，触发自动回滚：

```typescript
// deploy/canary-monitor.ts
async function monitorCanaryRelease(config: {
  canaryPercentage: number;
  monitorDuration: number; // minutes
  rollbackThreshold: number; // P75 恶化百分比
}) {
  const startTime = Date.now();
  const checkInterval = 5 * 60 * 1000; // 每 5 分钟检查一次

  while (Date.now() - startTime < config.monitorDuration * 60 * 1000) {
    await sleep(checkInterval);

    const canaryMetrics = await getRUMMetrics({ variant: "canary" });
    const stableMetrics = await getRUMMetrics({ variant: "stable" });

    for (const metric of ["LCP", "INP", "CLS"]) {
      const canaryP75 = canaryMetrics[metric].p75;
      const stableP75 = stableMetrics[metric].p75;
      const degradation = ((canaryP75 - stableP75) / stableP75) * 100;

      if (degradation > config.rollbackThreshold) {
        console.error(
          `🚨 性能回归检测：${metric} canary P75 ${canaryP75} vs stable P75 ${stableP75} (${degradation.toFixed(1)}% 恶化)`,
        );
        await triggerRollback();
        return;
      }
    }
  }

  // 监控期通过，推全量
  await promoteCanaryToStable();
}
```

## Dashboard / 重度 UI 系统的优化策略

### 问题特征

中后台 Dashboard 的性能问题与 C 端完全不同：

- **数据密集**：单页面可能渲染 20+ 个图表，每个图表数据量 1000+
- **实时更新**：WebSocket 推送每秒可能触发 10+ 次重渲染
- **交互复杂**：拖拽排列、联动筛选、深层下钻
- **长时间运行**：用户可能一整天不刷新页面，内存持续增长

### 策略一：渲染调度与优先级

```typescript
// 使用 Intersection Observer 实现"视口内优先渲染"
function useVisibilityPriority(containerRef: Ref<HTMLElement | null>) {
  const isVisible = ref(false);
  const hasEverBeenVisible = ref(false);

  onMounted(() => {
    if (!containerRef.value) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.value = entry.isIntersecting;
        if (entry.isIntersecting) {
          hasEverBeenVisible.value = true;
        }
      },
      { rootMargin: "200px" }, // 提前 200px 开始加载
    );

    observer.observe(containerRef.value);
    onUnmounted(() => observer.disconnect());
  });

  return { isVisible, hasEverBeenVisible };
}

// 在 Dashboard 组件中使用
// <ChartCard v-for="card in cards" :key="card.id">
//   <template v-if="card.hasEverBeenVisible">
//     <ActualChart :data="card.data" />
//   </template>
//   <template v-else>
//     <ChartPlaceholder />
//   </template>
// </ChartCard>
```

### 策略二：数据更新的节流与批处理

```typescript
// WebSocket 数据推送的批处理
class DataStreamProcessor {
  private buffer: Map<string, any> = new Map();
  private rafId: number | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  // 接收推送的数据，缓存到 buffer
  push(channel: string, data: any) {
    this.buffer.set(channel, data);
    this.scheduleFlush();
  }

  // 使用 rAF 合并同一帧内的所有更新
  private scheduleFlush() {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.flush();
      this.rafId = null;
    });
  }

  private flush() {
    for (const [channel, data] of this.buffer) {
      const subs = this.subscribers.get(channel);
      if (subs) {
        subs.forEach((cb) => cb(data));
      }
    }
    this.buffer.clear();
  }

  subscribe(channel: string, callback: (data: any) => void) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
    return () => this.subscribers.get(channel)?.delete(callback);
  }
}
```

### 策略三：图表渲染优化

```typescript
// ECharts 在大数据量下的优化配置
function createOptimizedChartOption(data: DataPoint[]): EChartsOption {
  return {
    // 启用大数据量模式
    series: [
      {
        type: "line",
        data: data,
        large: true, // 启用大数据优化
        largeThreshold: 2000, // 数据点超过 2000 时启用
        sampling: "lttb", // Largest Triangle Three Buckets 降采样
        progressive: 500, // 渐进式渲染，每帧渲染 500 个点
        progressiveThreshold: 3000,
      },
    ],
    // 关闭动画（大数据量下动画是性能杀手）
    animation: data.length < 1000,
    // 使用 Canvas 而非 SVG
    renderer: "canvas",
  };
}

// 图表实例的生命周期管理（防止内存泄漏）
function useChart(containerRef: Ref<HTMLElement | null>) {
  let chartInstance: ECharts | null = null;

  onMounted(() => {
    if (containerRef.value) {
      chartInstance = init(containerRef.value, null, {
        renderer: "canvas",
        useDirtyRect: true, // 脏矩形渲染，只重绘变化区域
      });
    }
  });

  onUnmounted(() => {
    chartInstance?.dispose();
    chartInstance = null;
  });

  // 响应容器尺寸变化
  useResizeObserver(containerRef, () => {
    chartInstance?.resize();
  });

  return { chartInstance };
}
```

### 策略四：内存治理

长时间运行的 Dashboard 最容易出现内存泄漏：

```typescript
// 内存监控工具
class MemoryMonitor {
  private snapshots: Array<{ timestamp: number; usedJSHeapSize: number }> = [];
  private intervalId: number | null = null;

  start(intervalMs: number = 30000) {
    this.intervalId = window.setInterval(() => {
      if ("memory" in performance) {
        const mem = (performance as any).memory;
        this.snapshots.push({
          timestamp: Date.now(),
          usedJSHeapSize: mem.usedJSHeapSize,
        });

        // 检测内存持续增长（可能泄漏）
        if (this.snapshots.length > 10) {
          const recent = this.snapshots.slice(-10);
          const growth = recent[9].usedJSHeapSize - recent[0].usedJSHeapSize;
          const growthPerMin =
            growth / ((recent[9].timestamp - recent[0].timestamp) / 60000);

          if (growthPerMin > 5 * 1024 * 1024) {
            // 每分钟增长超过 5MB
            console.warn(
              `⚠️ 疑似内存泄漏：${(growthPerMin / 1024 / 1024).toFixed(1)}MB/min`,
            );
            this.reportLeak(growthPerMin);
          }
        }

        // 保留最近 1 小时的快照
        const oneHourAgo = Date.now() - 3600 * 1000;
        this.snapshots = this.snapshots.filter((s) => s.timestamp > oneHourAgo);
      }
    }, intervalMs);
  }

  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  private reportLeak(growthPerMin: number) {
    navigator.sendBeacon(
      "/api/rum/memory-leak",
      JSON.stringify({
        url: location.href,
        growthPerMin,
        timestamp: Date.now(),
      }),
    );
  }
}
```

### 策略五：Web Worker 卸载计算

将数据处理从主线程迁移到 Worker：

```typescript
// workers/data-processor.worker.ts
self.addEventListener("message", (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case "aggregate": {
      // 在 Worker 中执行耗时的聚合计算
      const result = aggregateMetrics(payload.rawData, payload.dimensions);
      self.postMessage({ type: "aggregate:result", payload: result });
      break;
    }
    case "sort": {
      const sorted = payload.data.sort((a: any, b: any) =>
        payload.direction === "asc"
          ? a[payload.field] - b[payload.field]
          : b[payload.field] - a[payload.field],
      );
      self.postMessage({ type: "sort:result", payload: sorted });
      break;
    }
  }
});

// 主线程使用
function useDataWorker() {
  const worker = new Worker(
    new URL("./workers/data-processor.worker.ts", import.meta.url),
    { type: "module" },
  );

  function aggregate(rawData: any[], dimensions: string[]): Promise<any> {
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === "aggregate:result") {
          worker.removeEventListener("message", handler);
          resolve(e.data.payload);
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({
        type: "aggregate",
        payload: { rawData, dimensions },
      });
    });
  }

  onUnmounted(() => worker.terminate());
  return { aggregate };
}
```

## 总结

复杂系统的性能治理是一个**闭环系统**：

```
度量 (RUM) → 预算 (Budget) → 检测 (CI Regression) → 修复 → 验证 → 度量
```

关键原则：

1. **RUM 优先于 Lab**：决策依据是真实用户的 P75，不是 Lighthouse 跑分
2. **预算必须可执行**：集成到 CI，超标即阻断合并
3. **回归检测自动化**：不依赖人工发现，发布后自动对比
4. **针对场景优化**：Dashboard 的优化策略（虚拟化、Worker、批处理）和 C 端（首屏、LCP）完全不同

性能治理不是一个"项目"，而是一种持续运营的**工程能力**。
