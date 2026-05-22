---
title: "前端性能监控：AI 驱动的自动优化"
date: 2025-08-10 11:44:21
tags:
  - 工程化
  - 性能优化
readingTime: 2
description: "传统的性能监控是发现问题后人工排查。2025 年，AI 不仅能发现问题，还能自动建议甚至自动修复。"
wordCount: 167
---

传统的性能监控是发现问题后人工排查。2025 年，AI 不仅能发现问题，还能自动建议甚至自动修复。

## 监控架构

```
用户浏览器
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  数据采集    │────▶│  AI 分析引擎 │────▶│  自动修复    │
│  (web-vitals)│     │  (Claude)    │     │  (PR/配置)   │
└─────────────┘     └─────────────┘     └─────────────┘
    │                      │                    │
    ▼                      ▼                    ▼
  原始指标            性能报告 + 诊断      自动创建修复 PR
```

## 数据采集

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

    // 上报到分析平台
    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      // 用 sendBeacon 保证页面关闭时也能发送
      keepalive: true,
    }).catch(() => {
      navigator.sendBeacon?.("/api/vitals", JSON.stringify(entry));
    });

    // 性能差时立即告警
    if (entry.rating === "poor") {
      console.warn(`[Performance] ${entry.name} = ${entry.value} (${entry.rating})`);
    }
  };

  onLCP(report);
  onINP(report);
  onCLS(report);
  onTTFB(report);
}

// 路由切换时重新采集（SPA 场景）
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
    system: `你是一个前端性能专家。分析性能数据，给出具体可执行的优化建议。
输出 JSON 格式：
{
  "diagnosis": "问题诊断",
  "rootCauses": ["原因1", "原因2"],
  "suggestions": [
    {
      "priority": "high|medium|low",
      "action": "具体操作",
      "estimatedImpact": "预期提升",
      "codeExample": "代码示例（可选）"
    }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `分析以下页面性能数据：

页面：${report.page}
趋势：${report.trend}
回归：${report.regressions.join(", ")}

LCP: P50=${report.metrics.lcp.p50}ms, P75=${report.metrics.lcp.p75}ms, P95=${report.metrics.lcp.p95}ms
INP: P50=${report.metrics.inp.p50}ms, P75=${report.metrics.inp.p75}ms, P95=${report.metrics.inp.p95}ms
CLS: P50=${report.metrics.cls.p50}, P75=${report.metrics.cls.p75}, P95=${report.metrics.cls.p95}
TTFB: P50=${report.metrics.ttfb.p50}ms, P75=${report.metrics.ttfb.p75}ms, P95=${report.metrics.ttfb.p95}ms

Core Web Vitals 阈值：LCP<2.5s, INP<200ms, CLS<0.1`,
      },
    ],
  });

  return JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");
}
```

## 自动优化建议

```tsx
// AI 生成的实际优化建议示例

// 诊断：LCP P75 = 4.2s，超过阈值
// 原因：首屏大图未 preload，字体阻塞渲染

// 建议 1：Preload 关键资源
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* preload LCP 图片 */}
        <link
          rel="preload"
          as="image"
          href="/hero-banner.webp"
          fetchPriority="high"
        />
        {/* preload 关键字体 */}
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

// 建议 2：图片优化
// components/HeroBanner.tsx
import Image from "next/image";

export function HeroBanner() {
  return (
    <Image
      src="/hero-banner.webp"
      width={1920}
      height={800}
      priority  // 自动 preload + fetchPriority="high"
      sizes="100vw"
      alt="首屏"
      // 自动生成 srcset，按需加载不同尺寸
    />
  );
}

// 建议 3：字体优化
// 用 font-display: swap 避免字体阻塞
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-display: swap;  // 先用系统字体，字体加载后替换
}
```

## 回归检测

```ts
// 性能回归自动告警
function checkRegression(current: PerfReport, baseline: PerfReport) {
  const regressions: string[] = [];
  const THRESHOLD = 0.2; // 20% 以上算回归

  for (const metric of ["lcp", "inp", "cls", "ttfb"] as const) {
    const currentP75 = current.metrics[metric].p75;
    const baselineP75 = baseline.metrics[metric].p75;
    const change = (currentP75 - baselineP75) / baselineP75;

    if (change > THRESHOLD) {
      regressions.push(
        `${metric.toUpperCase()} P75 从 ${baselineP75} 升至 ${currentP75}（+${(change * 100).toFixed(1)}%）`,
      );
    }
  }

  if (regressions.length > 0) {
    // 自动创建 Issue 或发送告警
    notifyTeam({
      title: "性能回归告警",
      body: regressions.join("\n"),
      severity: regressions.length > 2 ? "critical" : "warning",
    });
  }
}
```

## 小结

- 性能监控要采集真实用户数据（RUM），不能只依赖实验室数据
- AI 不仅能分析性能数据，还能给出具体可执行的优化建议
- 自动回归检测能在线上性能变差时及时告警
- 性能优化是持续的过程，不是一次性的任务
- 把性能指标加入 CI 门禁，防止回归
