---
title: "フロントエンドパフォーマンス監視：AI駆動の自動最適化"
date: 2025-08-10 10:00:00
tags:
  - エンジニアリング
  - パフォーマンス最適化
readingTime: 3
description: "従来のパフォーマンス監視は、問題が発生した後に人が手動で調査するものでした。2025年、AIは問題を検出するだけでなく、自動的に提案し、さらには自動修正まで行えます。"
---

従来のパフォーマンス監視は、問題が発生した後に人が手動で調査するものでした。2025年、AIは問題を検出するだけでなく、自動的に提案し、さらには自動修正まで行えます。

## 監視アーキテクチャ

```
ユーザーブラウザ
    │
    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  データ収集  │────▶│  AI分析エンジン│────▶│  自動修正   │
│  (web-vitals)│     │  (Claude)    │     │  (PR/設定)   │
└─────────────┘     └─────────────┘     └─────────────┘
    │                      │                    │
    ▼                      ▼                    ▼
  生メトリクス       パフォーマンスレポート+診断  自動修正PR作成
```

## データ収集

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

    // 分析プラットフォームへのレポート
    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
      // sendBeaconでページクローズ時も確実に送信
      keepalive: true,
    }).catch(() => {
      navigator.sendBeacon?.("/api/vitals", JSON.stringify(entry));
    });

    // パフォーマンスが低い場合は即座にアラート
    if (entry.rating === "poor") {
      console.warn(`[Performance] ${entry.name} = ${entry.value} (${entry.rating})`);
    }
  };

  onLCP(report);
  onINP(report);
  onCLS(report);
  onTTFB(report);
}

// ルート切り替え時に再収集（SPAシナリオ）
let lastPath = window.location.pathname;
new PerformanceObserver(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    collectVitals();
  }
}).observe({ type: "navigation", buffered: true });
```

## AI分析エンジン

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
    system: `あなたはフロントエンドパフォーマンスの専門家です。パフォーマンスデータを分析し、具体的で実行可能な最適化提案を提供してください。
JSON形式で出力：
{
  "diagnosis": "問題診断",
  "rootCauses": ["原因1", "原因2"],
  "suggestions": [
    {
      "priority": "high|medium|low",
      "action": "具体的なアクション",
      "estimatedImpact": "期待される改善効果",
      "codeExample": "コード例（オプション）"
    }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `以下のページパフォーマンスデータを分析してください：

ページ：${report.page}
トレンド：${report.trend}
リグレッション：${report.regressions.join(", ")}

LCP: P50=${report.metrics.lcp.p50}ms, P75=${report.metrics.lcp.p75}ms, P95=${report.metrics.lcp.p95}ms
INP: P50=${report.metrics.inp.p50}ms, P75=${report.metrics.inp.p75}ms, P95=${report.metrics.inp.p95}ms
CLS: P50=${report.metrics.cls.p50}, P75=${report.metrics.cls.p75}, P95=${report.metrics.cls.p95}
TTFB: P50=${report.metrics.ttfb.p50}ms, P75=${report.metrics.ttfb.p75}ms, P95=${report.metrics.ttfb.p95}ms

Core Web Vitals閾値：LCP<2.5s, INP<200ms, CLS<0.1`,
      },
    ],
  });

  return JSON.parse(response.content[0].type === "text" ? response.content[0].text : "{}");
}
```

## 自動最適化提案

```tsx
// AIが生成した実際の最適化提案例

// 診断：LCP P75 = 4.2s、閾値超過
// 原因：ファーストビュー大画像のプリロードなし、フォントがレンダリングをブロック

// 提案1：クリティカルリソースのプリロード
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        {/* LCP画像をプリロード */}
        <link
          rel="preload"
          as="image"
          href="/hero-banner.webp"
          fetchPriority="high"
        />
        {/* クリティカルフォントをプリロード */}
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

// 提案2：画像最適化
// components/HeroBanner.tsx
import Image from "next/image";

export function HeroBanner() {
  return (
    <Image
      src="/hero-banner.webp"
      width={1920}
      height={800}
      priority  // 自動プリロード + fetchPriority="high"
      sizes="100vw"
      alt="ヒーローバナー"
      // 自動でsrcsetを生成し、必要なサイズのみ読み込む
    />
  );
}

// 提案3：フォント最適化
// font-display: swapでフォントブロッキングを回避
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter-var.woff2") format("woff2");
  font-display: swap;  // まずシステムフォントを使用し、読み込み後に切り替え
}
```

## リグレッション検出

```ts
// パフォーマンスリグレッションの自動アラート
function checkRegression(current: PerfReport, baseline: PerfReport) {
  const regressions: string[] = [];
  const THRESHOLD = 0.2; // 20%以上をリグレッションとみなす

  for (const metric of ["lcp", "inp", "cls", "ttfb"] as const) {
    const currentP75 = current.metrics[metric].p75;
    const baselineP75 = baseline.metrics[metric].p75;
    const change = (currentP75 - baselineP75) / baselineP75;

    if (change > THRESHOLD) {
      regressions.push(
        `${metric.toUpperCase()} P75 が ${baselineP75} から ${currentP75} に上昇（+${(change * 100).toFixed(1)}%）`,
      );
    }
  }

  if (regressions.length > 0) {
    // Issueを自動作成またはアラート送信
    notifyTeam({
      title: "パフォーマンスリグレッションアラート",
      body: regressions.join("\n"),
      severity: regressions.length > 2 ? "critical" : "warning",
    });
  }
}
```

## まとめ

- パフォーマンス監視はリアルユーザーデータ（RUM）を収集する必要があり、ラボデータだけに頼ってはいけません
- AIはパフォーマンスデータを分析し、具体的で実行可能な最適化提案を提供できます
- 自動リグレッション検出により、本番のパフォーマンス低下をタイムリーにアラートできます
- パフォーマンス最適化は継続的なプロセスであり、一度きりの作業ではありません
- パフォーマンス指標をCIゲートに組み込み、リグレッションを防止してください
