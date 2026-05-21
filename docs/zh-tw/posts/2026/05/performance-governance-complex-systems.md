---
title: "複雜系統的效能治理：RUM、效能預算與自動化迴歸檢測"
date: 2026-05-15 09:43:12
tags:
  - 效能最佳化
  - 效能
  - 工程化
readingTime: 8
description: "當你的應用是一個包含 50+ 個頁面、100+ 個圖表、即時資料流重新整理的中後臺系統時，效能問題不再是\"某個頁面慢\"這麼簡單。它是一個需要持續投入、系統性治理的工程問題。本文討論如何用 RUM（真實使用者監控）建立效能基線，如何設計和執行效能預算，如何在 CI 中自動檢測效能迴歸，以及如何最佳化 Dashboard "
wordCount: 840
---

當你的應用是一個包含 50+ 個頁面、100+ 個圖表、即時資料流重新整理的中後臺系統時，效能問題不再是"某個頁面慢"這麼簡單。它是一個需要持續投入、系統性治理的工程問題。本文討論如何用 RUM（真實使用者監控）建立效能基線，如何設計和執行效能預算，如何在 CI 中自動檢測效能迴歸，以及如何最佳化 Dashboard 類重度 UI 系統。

## RUM：真實使用者視角的效能度量

### 為什麼 Lab 資料不夠

Lighthouse 和 WebPageTest 跑出來的資料是**實驗室資料**——固定網速、固定裝置、空快取。但真實使用者的情況是：

- 30% 的使用者在 3G/4G 弱網環境
- 15% 的使用者裝置 RAM < 4GB
- 使用者可能已有快取（回訪），也可能是首次訪問
- 某些地區的 CDN 節點覆蓋不佳

Lab 資料用於**診斷**，RUM 資料用於**決策**。

### RUM 採集架構

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
    route: getCurrentRoutePattern(), // 從 router 獲取
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

// 註冊所有 Web Vitals 採集
onLCP(collectMetric);
onINP(collectMetric);
onCLS(collectMetric);
onFCP(collectMetric);
onTTFB(collectMetric);

// 頁面離開時批次上報
function flushMetrics() {
  if (metricsBuffer.length === 0) return;

  const payload: RUMPayload = {
    metrics: [...metricsBuffer],
    context: getPageContext(),
  };

  // 使用 sendBeacon 確保頁面關閉時也能傳送
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  navigator.sendBeacon("/api/rum/collect", blob);

  metricsBuffer.length = 0;
}

// 頁面隱藏時上報（比 unload 更可靠）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushMetrics();
  }
});
```

### RUM 資料的分析維度

收集到的 RUM 資料需要按多個維度聚合才有價值：

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

-- 按網路型別分析效能差異
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

### 建立效能基線和告警

```typescript
// 效能告警規則
interface PerformanceAlert {
  metric: "LCP" | "INP" | "CLS";
  route: string;
  threshold: number; // P75 值
  window: "1h" | "24h" | "7d";
  action: "slack" | "pagerduty";
}

const ALERT_RULES: PerformanceAlert[] = [
  // 首頁 LCP P75 超過 3s 觸發告警
  { metric: "LCP", route: "/", threshold: 3000, window: "1h", action: "slack" },
  // Dashboard INP P75 超過 300ms 觸發告警
  {
    metric: "INP",
    route: "/dashboard/*",
    threshold: 300,
    window: "1h",
    action: "slack",
  },
  // 任何頁面 CLS 超過 0.25 緊急告警
  {
    metric: "CLS",
    route: "*",
    threshold: 0.25,
    window: "1h",
    action: "pagerduty",
  },
];
```

## 效能預算：從目標到執行

### 設計效能預算

效能預算不是拍腦袋定一個數字，而是基於**使用者體驗目標**倒推：

```
使用者體驗目標：
  LCP < 2.5s (P75)
  INP < 200ms (P75)

倒推技術約束：
  → 首屏 JS < 150KB (gzipped)
     理由：3G 網路下載 150KB ≈ 1.5s，解析執行 ≈ 0.5s，加 TTFB ≈ 0.5s = 2.5s
  → 首屏 CSS < 50KB (gzipped)
  → 首屏關鍵圖片 < 200KB
  → 主執行緒單任務 < 50ms
     理由：INP = input delay + processing + presentation，processing < 50ms 才能保證總和 < 200ms
```

### 預算的分配策略

```typescript
// performance-budget.config.ts
export interface BudgetConfig {
  // 按資源型別分配
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

### 預算執行機制

預算如果只是寫在文件裡等於沒有。必須整合到工程流程中：

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

  // 檢查總 JS 體積
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

  // 檢查單個路由 chunk 體積
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

// CI 整合
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

## 自動化效能迴歸檢測

### Lab 環境的迴歸檢測

在 CI 中執行 Lighthouse CI，對比 PR 前後的效能變化：

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

### RUM 資料的迴歸檢測

Lab 檢測只能發現明顯的迴歸。更精確的方法是對比**釋出前後的 RUM P75**：

```typescript
// scripts/rum-regression-check.ts
interface ReleaseComparison {
  metric: string;
  route: string;
  before: { p75: number; sampleCount: number };
  after: { p75: number; sampleCount: number };
  delta: number; // 絕對變化
  deltaPercent: number; // 百分比變化
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
        // 迴歸判定：P75 惡化超過 10% 且絕對值超過閾值
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

### 自動回滾機制

當檢測到嚴重效能迴歸時，觸發自動回滾：

```typescript
// deploy/canary-monitor.ts
async function monitorCanaryRelease(config: {
  canaryPercentage: number;
  monitorDuration: number; // minutes
  rollbackThreshold: number; // P75 惡化百分比
}) {
  const startTime = Date.now();
  const checkInterval = 5 * 60 * 1000; // 每 5 分鐘檢查一次

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
          `🚨 效能迴歸檢測：${metric} canary P75 ${canaryP75} vs stable P75 ${stableP75} (${degradation.toFixed(1)}% 惡化)`,
        );
        await triggerRollback();
        return;
      }
    }
  }

  // 監控期通過，推全量
  await promoteCanaryToStable();
}
```

## Dashboard / 重度 UI 系統的最佳化策略

### 問題特徵

中後臺 Dashboard 的效能問題與 C 端完全不同：

- **資料密集**：單頁面可能渲染 20+ 個圖表，每個圖表資料量 1000+
- **即時更新**：WebSocket 推送每秒可能觸發 10+ 次重渲染
- **互動複雜**：拖拽排列、聯動篩選、深層下鑽
- **長時間執行**：使用者可能一整天不重新整理頁面，記憶體持續增長

### 策略一：渲染排程與優先順序

```typescript
// 使用 Intersection Observer 實現"視口內優先渲染"
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
      { rootMargin: "200px" }, // 提前 200px 開始載入
    );

    observer.observe(containerRef.value);
    onUnmounted(() => observer.disconnect());
  });

  return { isVisible, hasEverBeenVisible };
}

// 在 Dashboard 元件中使用
// <ChartCard v-for="card in cards" :key="card.id">
//   <template v-if="card.hasEverBeenVisible">
//     <ActualChart :data="card.data" />
//   </template>
//   <template v-else>
//     <ChartPlaceholder />
//   </template>
// </ChartCard>
```

### 策略二：資料更新的節流與批處理

```typescript
// WebSocket 資料推送的批處理
class DataStreamProcessor {
  private buffer: Map<string, any> = new Map();
  private rafId: number | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();

  // 接收推送的資料，快取到 buffer
  push(channel: string, data: any) {
    this.buffer.set(channel, data);
    this.scheduleFlush();
  }

  // 使用 rAF 合併同一幀內的所有更新
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

### 策略三：圖表渲染最佳化

```typescript
// ECharts 在大數據量下的最佳化配置
function createOptimizedChartOption(data: DataPoint[]): EChartsOption {
  return {
    // 啟用大數據量模式
    series: [
      {
        type: "line",
        data: data,
        large: true, // 啟用大數據最佳化
        largeThreshold: 2000, // 資料點超過 2000 時啟用
        sampling: "lttb", // Largest Triangle Three Buckets 降取樣
        progressive: 500, // 漸進式渲染，每幀渲染 500 個點
        progressiveThreshold: 3000,
      },
    ],
    // 關閉動畫（大數據量下動畫是效能殺手）
    animation: data.length < 1000,
    // 使用 Canvas 而非 SVG
    renderer: "canvas",
  };
}

// 圖表例項的生命週期管理（防止記憶體洩漏）
function useChart(containerRef: Ref<HTMLElement | null>) {
  let chartInstance: ECharts | null = null;

  onMounted(() => {
    if (containerRef.value) {
      chartInstance = init(containerRef.value, null, {
        renderer: "canvas",
        useDirtyRect: true, // 髒矩形渲染，只重繪變化區域
      });
    }
  });

  onUnmounted(() => {
    chartInstance?.dispose();
    chartInstance = null;
  });

  // 響應容器尺寸變化
  useResizeObserver(containerRef, () => {
    chartInstance?.resize();
  });

  return { chartInstance };
}
```

### 策略四：記憶體治理

長時間執行的 Dashboard 最容易出現記憶體洩漏：

```typescript
// 記憶體監控工具
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

        // 檢測記憶體持續增長（可能洩漏）
        if (this.snapshots.length > 10) {
          const recent = this.snapshots.slice(-10);
          const growth = recent[9].usedJSHeapSize - recent[0].usedJSHeapSize;
          const growthPerMin =
            growth / ((recent[9].timestamp - recent[0].timestamp) / 60000);

          if (growthPerMin > 5 * 1024 * 1024) {
            // 每分鐘增長超過 5MB
            console.warn(
              `⚠️ 疑似記憶體洩漏：${(growthPerMin / 1024 / 1024).toFixed(1)}MB/min`,
            );
            this.reportLeak(growthPerMin);
          }
        }

        // 保留最近 1 小時的快照
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

### 策略五：Web Worker 解除安裝計算

將資料處理從主執行緒遷移到 Worker：

```typescript
// workers/data-processor.worker.ts
self.addEventListener("message", (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case "aggregate": {
      // 在 Worker 中執行耗時的聚合計算
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

// 主執行緒使用
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

## 總結

複雜系統的效能治理是一個**閉環系統**：

```
度量 (RUM) → 預算 (Budget) → 檢測 (CI Regression) → 修復 → 驗證 → 度量
```

關鍵原則：

1. **RUM 優先於 Lab**：決策依據是真實使用者的 P75，不是 Lighthouse 跑分
2. **預算必須可執行**：整合到 CI，超標即阻斷合併
3. **迴歸檢測自動化**：不依賴人工發現，釋出後自動對比
4. **針對場景最佳化**：Dashboard 的最佳化策略（虛擬化、Worker、批處理）和 C 端（首屏、LCP）完全不同

效能治理不是一個"專案"，而是一種持續運營的**工程能力**。
