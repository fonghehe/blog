---
title: "複雑システムのパフォーマンスガバナンス：RUM・パフォーマンス予算・自動回帰検出"
date: 2026-05-15 09:43:12
tags:
  - パフォーマンス最適化
  - パフォーマンス
  - エンジニアリング
readingTime: 3
description: "アプリケーションが50ページ以上・100チャート以上・リアルタイムデータストリームを持つ中〜大規模システムである場合、パフォーマンス問題はもはや「あるページが遅い」という単純な話ではない。継続的な投資とシステム的なガバナンスが必要なエンジニアリング問題だ。本稿は、RUM（リアルユーザーモニタリング）でパフォーマンスベー"
---

アプリケーションが50ページ以上・100チャート以上・リアルタイムデータストリームを持つ中〜大規模システムである場合、パフォーマンス問題はもはや「あるページが遅い」という単純な話ではない。継続的な投資とシステム的なガバナンスが必要なエンジニアリング問題だ。本稿は、RUM（リアルユーザーモニタリング）でパフォーマンスベースラインを構築する方法、パフォーマンス予算の設計と実施、CIでの自動回帰検出、そしてDashboard類の重量UIシステムの最適化について論じる。

## RUM：リアルユーザー視点のパフォーマンス計測

### ラボデータだけでは不十分な理由

LighthouseやWebPageTestのデータは**ラボデータ** ─ 固定ネットワーク速度、固定デバイス、空キャッシュ。しかし実際のユーザーは：

- 30%が3G/4G弱ネット環境
- 15%がRAM 4GB未満のデバイス
- ウォームキャッシュ（再訪）または初回訪問
- CDNノードのカバレッジが地域によって異なる

ラボデータは**診断**に使い、RUMデータは**意思決定**に使う。

### RUM収集アーキテクチャ

```typescript
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from "web-vitals";

const metricsBuffer: Array<{
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}> = [];

function collectMetric(metric: Metric) {
  metricsBuffer.push({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
  });
}

// すべてのWeb Vitalsを登録
onLCP(collectMetric);
onINP(collectMetric);
onCLS(collectMetric);
onFCP(collectMetric);
onTTFB(collectMetric);

// ページ離脱時にバッチ送信（unloadよりvisibilitychangeが信頼性高い）
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && metricsBuffer.length > 0) {
    const blob = new Blob([JSON.stringify(metricsBuffer)], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/rum/collect", blob);
  }
});
```

### RUMデータの分析次元

```sql
-- ルート別P75 LCP
SELECT
  route,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75_lcp,
  COUNT(*) as sample_count
FROM rum_metrics
WHERE name = 'LCP' AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY route HAVING COUNT(*) > 100
ORDER BY p75_lcp DESC;
```

### ベースラインとアラートの構築

```typescript
const ALERT_RULES = [
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

## パフォーマンス予算：目標から実施まで

### 予算の設計

パフォーマンス予算は感覚的な数字ではなく、**ユーザー体験目標**から逆算する：

```
ユーザー体験目標：
  LCP < 2.5s (P75)
  INP < 200ms (P75)

技術的制約を逆算：
  → 初回描画JS < 150KB (gzipped)
     根拠：3Gで150KBダウンロード ≈ 1.5s、解析実行 ≈ 0.5s、TTFB ≈ 0.5s = 2.5s
  → 初回描画CSS < 50KB (gzipped)
  → クリティカル画像 < 200KB
  → メインスレッド単一タスク < 50ms
```

### CIでの予算強制適用

```typescript
// Lighthouse CIの予算チェック
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

## Dashboard最適化：最も難しいシナリオ

Dashboard類のUIは最も難しいパフォーマンスシナリオ ─ 100以上のチャート + リアルタイムデータストリームがすべてのボトルネックを同時に押しつける：

```typescript
// 戦略1：ビューポートベースの遅延レンダリング
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
  { rootMargin: "200px" },
);

// 戦略2：データ更新のスロットリング
const throttledUpdate = useThrottleFn((newData: ChartData) => {
  chartData.value = newData;
}, 1000); // 最大1秒に1回更新

// 戦略3：重い計算をWeb Workerへ
const worker = new Worker(
  new URL("./chart-processor.worker.ts", import.meta.url),
);
worker.postMessage({ rawData, config });
worker.onmessage = (e) => {
  processedData.value = e.data;
};
```

## まとめ

複雑システムのパフォーマンスガバナンスには3つの層が連動する必要がある：実際のユーザー体験を把握する**RUM**、その理解をCIで強制できる制約に変換する**パフォーマンス予算**、そして最も難しいランタイムシナリオに対処する**Dashboard固有の最適化**（遅延レンダリング・データスロットリング・Web Worker）。3つの層がすべて整えば、パフォーマンスはシステムの特性となり、英雄的な一発勝負の最適化から卒業できる。
