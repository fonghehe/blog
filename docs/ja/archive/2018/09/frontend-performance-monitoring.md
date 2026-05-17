---
title: "フロントエンドパフォーマンス監視の実践"
date: 2018-09-30 10:45:26
tags:
  - パフォーマンス最適化
readingTime: 2
description: "しばらくパフォーマンス最適化をしてきましたが、本番のパフォーマンスを体系的に監視したことがありませんでした。パフォーマンスデータを収集する方法を調べてみました。"
---

しばらくパフォーマンス最適化をしてきましたが、本番のパフォーマンスを体系的に監視したことがありませんでした。パフォーマンスデータを収集する方法を調べてみました。

## なぜ本番監視が必要か

```
DevTools で測定するのは自分のマシンの状況
実際のユーザーは：
  - 2G/3G ネットワーク
  - ローエンドの Android スマートフォン
  - ネットワークが不安定な地域

本番監視があって初めて、実際のユーザー体験がわかる
```

## Performance API

ブラウザ内蔵のパフォーマンスタイムスタンプ：

```javascript
// 各フェーズの時間を取得
const timing = performance.timing;

// よく使う指標の計算
const metrics = {
  // DNS 解決時間
  dns: timing.domainLookupEnd - timing.domainLookupStart,
  // TCP 接続時間
  tcp: timing.connectEnd - timing.connectStart,
  // 最初のバイト到着時間（TTFB）
  ttfb: timing.responseStart - timing.requestStart,
  // ページの完全読み込み時間
  load: timing.loadEventEnd - timing.navigationStart,
  // DOM 解析時間
  domParse: timing.domInteractive - timing.responseEnd,
  // 白画面時間（近似値）
  whiteScreen: timing.domLoading - timing.navigationStart,
};

console.log(metrics);
```

## PerformanceObserver の使用

```javascript
// LCP（最大コンテンツ描画）の監視
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log("LCP:", lastEntry.startTime);
  reportMetric("lcp", lastEntry.startTime);
});
lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

// FID（最初の入力遅延）の監視
const fidObserver = new PerformanceObserver((list) => {
  const entry = list.getEntries()[0];
  console.log("FID:", entry.processingStart - entry.startTime);
  reportMetric("fid", entry.processingStart - entry.startTime);
});
fidObserver.observe({ entryTypes: ["first-input"] });

// CLS（累積レイアウトシフト）の監視
let clsScore = 0;
const clsObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (!entry.hadRecentInput) {
      clsScore += entry.value;
    }
  });
});
clsObserver.observe({ entryTypes: ["layout-shift"] });

// ページを離れる際に CLS を送信
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    reportMetric("cls", clsScore);
  }
});
```

## リソース読み込みの監視

```javascript
// すべてのリソースの読み込み時間を取得
const resources = performance.getEntriesByType("resource");
resources.forEach((resource) => {
  if (resource.duration > 1000) {
    // 1秒以上かかったリソースを記録
    console.warn("遅いリソース:", resource.name, resource.duration + "ms");
  }
});
```

## バックエンドへの送信

```javascript
function reportMetric(name, value) {
  // sendBeacon で送信（ページのアンロードをブロックしない、fetch より信頼性が高い）
  const data = JSON.stringify({
    metric: name,
    value: Math.round(value),
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  navigator.sendBeacon("/api/metrics", data);
}
```

## 本番公開後に発覚した問題

監視を導入した後に判明したこと：

```
- モバイルユーザーの LCP はデスクトップより 3 倍遅い
- 特定の地域の TTFB が非常に高い（CDN ノードの問題）
- あるサードパーティの広告スクリプトが CLS を急上昇させている
```

データがなければ、これらの問題は永遠に発見できませんでした。

## まとめ

- `performance.timing`：各フェーズのタイムスタンプ（TTFB、DNS、TCP など）
- `PerformanceObserver`：LCP、FID、CLS などの指標を監視
- `navigator.sendBeacon`：ページのアンロード時に確実にデータを送信
- 本番監視は実際のパフォーマンス問題を発見する唯一の方法。ローカルの DevTools では不十分
