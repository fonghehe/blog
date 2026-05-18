---
title: "前端效能監控：AI 驅動的自動最佳化"
date: 2025-08-10 10:00:00
tags:
  - 工程化
  - 效能最佳化
readingTime: 2
description: "傳統的效能監控是發現問題後人工排查。2025 年，AI 不僅能發現問題，還能自動建議甚至自動修復。"
---

傳統的效能監控是發現問題後人工排查。2025 年，AI 不僅能發現問題，還能自動建議甚至自動修復。

## 監控架構

```
使用者瀏覽器
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  資料採集    │────▶│  AI 分析引擎 │────▶│  自動修復    │
│  (web-vitals)│     │  (Claude)    │     │  (PR/配置)   │
└─────────────┘     └─────────────┘     └─────────────┘
    │                      │                    │
    ▼                      ▼                    ▼
  原始指標            效能報告 + 診斷      自動建立修復 PR
```

## 資料採集

```ts
// lib/performance-monitor.ts
import { onLCP, onINP, onCLS, onTTFB, type Metric } from "web-vitals";

interface PerformanceEntry extends Metric {
  url: string;
  userAgent: string;
  connectionType: string;
  deviceMemory: number;
  timestamp: number;
}

function collectVitals() {
  const baseData = {
    url: window.location.href,
    userAgent: navigator.userAgent,
    connectionType: (navigator as any).connection?.effectiveType ?? "unknown",
    deviceMemory: (navigator as any).deviceMemory ?? 0,
    timestamp: Date.now(),
  };

  const report = (metric: Metric) => {
    const entry: PerformanceEntry = { ...metric, ...baseData };

    // 上報到分析平臺
    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      // 用 sendBeacon 保證頁面關閉時也能傳送
      keepalive: true,
    }).catch(() => {
      navigator.sendBeacon?.("/api/vitals", JSON.stringify(entry));
    });

    // 效能差時立即告警
    if (entry.rating === "poor") {
      console.warn(`[Performance] ${entry.name} = ${entry.value} (${entry.rating})`);
    }
  };

  onLCP(report);
  onINP(report);
  onCLS(report);
  onTTFB(report);
}

// 路由切換時重新採集（SPA 場景）
let lastPath = window.location.pathname;
new PerformanceObserver(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    collectVitals();
  }
}).observe({ type: "navigation", buffered: true });
```

## AI 分析引擎

```ts
// scripts/performance-analyzer.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface PerfReport {
  page: string;
  metrics: {
    lcp: { p50: number; p75: number; p95: number };
    inp: { p50: number; p75: number; p95: number };
    cls: { p50: number; p75: number; p95: number };
    ttfb: { p50: number; p75: number; p95: number };
  };
  trend: "improving" | "stable" | "degrading";
  regressions: string[];
}

async function analyzePerformance(report: PerfReport) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `你是一個前端效能專家。分析效能資料，給出具體可執行的最佳化建議。
輸出 JSON 格式：
{
  "diagnosis": "問題診斷",
  "rootCauses": ["原因1", "原因2"],
  "suggestions": [
    {
      "priority": "high|medium|low",
      "action": "具體操作",
      "estimatedImpact": "預期提升",
      "codeExample": "程式碼示例（可選）"
    }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `分析以下頁面效能資料：

頁面：${report.page}
趨勢：${report.trend}
迴歸：${report.regressions.join(", ")}

LCP: P50=${report.metrics.lcp.p50}ms, P75=${report.metrics.lcp.p75}ms, P95=${report.metrics.lcp.p95}ms
INP: P50=${report.metrics.inp.p50}ms, P75=${report.metrics.inp.p75}ms, P95=${report.metrics.inp.p95}ms
CLS: P50=${report.metrics.cls.p50}, P75=${report.metrics.cls.p75}, P95=${report.metrics.cls.p95}
TTFB: P50=${report.metrics.ttfb.p50}ms, P75=${report.metrics.ttfb.p75}ms, P95=${report.metrics.ttfb.p95}ms

Core Web Vitals 閾值：LCP<2.5s, INP<200ms, CLS<0.1`,
      },
    ],
  });

  return JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");
}
```

## 自動最佳化建議

```tsx
// AI 生成的實際最佳化建議示例

// 診斷：LCP P75 = 4.2s，超過閾值
// 原因：首屏大圖未 preload，字型阻塞渲染

// 建議 1：Preload 關鍵資源
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* preload LCP 圖片 */}
        <link
          rel="preload"
          as="image"
          href="/hero-banner.webp"
          fetchPriority="high"
        />
        {/* preload 關鍵字型 */}
        <link
          rel="preload"
          as="font"
          href="/fonts/inter-var.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

// 建議 2：圖片最佳化
// components/HeroBanner.tsx
import Image from "next/image";

export function HeroBanner() {
  return (
    <Image
      src="/hero-banner.webp"
      width={1920}
      height={800}
      priority  // 自動 preload + fetchPriority="high"
      sizes="100vw"
      alt="首屏"
      // 自動生成 srcset，按需載入不同尺寸
    />
  );
}

// 建議 3：字型最佳化
// 用 font-display: swap 避免字型阻塞
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-display: swap;  // 先用系統字型，字型載入後替換
}
```

## 迴歸檢測

```ts
// 效能迴歸自動告警
function checkRegression(current: PerfReport, baseline: PerfReport) {
  const regressions: string[] = [];
  const THRESHOLD = 0.2; // 20% 以上算迴歸

  for (const metric of ["lcp", "inp", "cls", "ttfb"] as const) {
    const currentP75 = current.metrics[metric].p75;
    const baselineP75 = baseline.metrics[metric].p75;
    const change = (currentP75 - baselineP75) / baselineP75;

    if (change > THRESHOLD) {
      regressions.push(
        `${metric.toUpperCase()} P75 從 ${baselineP75} 升至 ${currentP75}（+${(change * 100).toFixed(1)}%）`,
      );
    }
  }

  if (regressions.length > 0) {
    // 自動建立 Issue 或傳送告警
    notifyTeam({
      title: "效能迴歸告警",
      body: regressions.join("\n"),
      severity: regressions.length > 2 ? "critical" : "warning",
    });
  }
}
```

## 小結

- 效能監控要採集真實使用者資料（RUM），不能只依賴實驗室資料
- AI 不僅能分析效能資料，還能給出具體可執行的最佳化建議
- 自動迴歸檢測能在線上效能變差時及時告警
- 效能最佳化是持續的過程，不是一次性的任務
- 把效能指標加入 CI 門禁，防止迴歸
