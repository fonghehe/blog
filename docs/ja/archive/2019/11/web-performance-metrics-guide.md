---
title: "Web Vitals：コアパフォーマンス指標ガイド"
date: 2019-11-14 16:51:28
tags:
  - パフォーマンス最適化
readingTime: 6
description: "Google は Web パフォーマンスの標準化を推進し続けており、ユーザー体験を測定するための一連のコアパフォーマンス指標を提案しています。これらの指標は読み込み速度、インタラクティブ性、視覚的安定性の 3 つの側面に焦点を当てています。この記事ではこれらの指標の意味と測定方法を紹介します。"
wordCount: 1135
---

GoogleはWebパフォーマンスの標準化を推進し続けており、ユーザー体験を測定するための一連のコアパフォーマンス指標を提案しています。これらの指標は読み込み速度、インタラクティブ性、視覚的安定性の3つの側面に焦点を当てています。この記事ではこれらの指標の意味と測定方法を紹介します。

## パフォーマンス指標の概要

Googleが提案するコアパフォーマンス指標は主に以下のとおりです：

- **LCP（Largest Contentful Paint）**：最大コンテンツ描画、読み込みパフォーマンスを測定
- **FID（First Input Delay）**：初回入力遅延、インタラクティブ性を測定
- **CLS（Cumulative Layout Shift）**：累積レイアウトシフト、視覚的安定性を測定

およびいくつかの補助指標：

- **FCP（First Contentful Paint）**：初回コンテンツ描画
- **TTI（Time to Interactive）**：インタラクティブになるまでの時間
- **TBT（Total Blocking Time）**：総ブロック時間
- **TTFB（Time to First Byte）**：初回バイトまでの時間

## FCP - 初回コンテンツ描画

FCPは、ページの読み込み開始から最初のコンテンツ（テキスト、画像、SVG）が画面に表示されるまでの時間を測定します：

```js
// Performance APIを使用してFCPを測定
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      console.log('FCP:', entry.startTime);
      observer.disconnect();
    }
  }
});

observer.observe({ type: 'paint', buffered: true });

// PerformancePaintTimingからも取得可能
const paintEntries = performance.getEntriesByType('paint');
const fcp = paintEntries.find(e => e.name === 'first-contentful-paint');
console.log('FCP:', fcp.startTime);
```

FCPの評価基準：
- 良好：<= 1.8秒
- 改善が必要：1.8 - 3秒
- 不良：> 3秒

## LCP - 最大コンテンツ描画

LCPは、ビューポート内の最大のコンテンツ要素（画像、動画、テキストブロック）の描画時間を測定します。FCPよりもユーザーが体感する読み込み速度をよりよく反映します：

```js
// LCPを測定
const lcpObserver = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  // LCPは更新される可能性がある（より大きなコンテンツ要素が表示されるたび）
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime);
  console.log('LCP要素:', lastEntry.element);
});

lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

// ページの完全読み込み後、オブザーバーを切断
window.addEventListener('load', () => {
  // 切断を遅らせて、最終的なLCPを確実にキャプチャ
  setTimeout(() => lcpObserver.disconnect(), 1000);
});
```

LCPの評価基準：
- 良好：<= 2.5秒
- 改善が必要：2.5 - 4秒
- 不良：> 4秒

LCPに影響を与える要因と最適化戦略：

```html
<!-- 1. クリティカルリソースの読み込みを最適化 -->
<link rel="preload" href="/hero-image.webp" as="image">

<!-- 2. 適切な画像形式を使用 -->
<picture>
  <source srcset="/hero.webp" type="image/webp">
  <img src="/hero.jpg" alt="Hero" loading="eager" width="1200" height="600">
</picture>

<!-- 3. 重要なコンテンツをサーバーサイドレンダリング -->
<!-- クライアントJSで主要コンテンツをレンダリングしない -->
```

```js
// 4. クリティカルCSSを最適化
// クリティカルCSSをインライン化し、非クリティカルCSSは非同期読み込み
const nonCriticalCSS = document.createElement('link');
nonCriticalCSS.rel = 'stylesheet';
nonCriticalCSS.href = '/styles/non-critical.css';
document.head.appendChild(nonCriticalCSS);

// 5. フォント読み込みを最適化
// font-display: swapを使用してテキストのちらつきを防止
```

## FID - 初回入力遅延

FIDは、ユーザーが最初にページとインタラクション（クリック、入力など）を行ってから、ブラウザが実際にそのインタラクションの処理を開始するまでの時間差を測定します：

```js
// FIDを測定
const fidObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // processingStart - startTime = 入力遅延
    const delay = entry.processingStart - entry.startTime;
    console.log('FID:', delay);
    console.log('イベントタイプ:', entry.name);
    fidObserver.disconnect(); // FIDは最初のインタラクションのみを記録
  }
});

fidObserver.observe({ type: 'first-input', buffered: true });
```

FIDの評価基準：
- 良好：<= 100ms
- 改善が必要：100 - 300ms
- 不良：> 300ms

FIDに影響を与える主な原因は、メインスレッドが長いタスクにブロックされていることです：

```js
// 長いタスクの最適化：複数の小さなタスクに分割
function processLargeArray(items) {
  // 悪い例：一度にすべてのデータを処理し、メインスレッドをブロック
  // items.forEach(item => heavyProcessing(item));

  // 良い例：バッチ処理し、バッチ間でメインスレッドを解放
  const batchSize = 100;
  let index = 0;

  function processBatch() {
    const batch = items.slice(index, index + batchSize);
    batch.forEach(item => heavyProcessing(item));
    index += batchSize;

    if (index < items.length) {
      // MessageChannelまたはsetTimeoutを使用してメインスレッドを解放
      setTimeout(processBatch, 0);
    }
  }

  processBatch();
}

// またはrequestIdleCallbackを使用
function processOnIdle(items) {
  function processNext(deadline) {
    while (deadline.timeRemaining() > 0 && items.length > 0) {
      const item = items.shift();
      heavyProcessing(item);
    }
    if (items.length > 0) {
      requestIdleCallback(processNext);
    }
  }
  requestIdleCallback(processNext);
}
```

## CLS - 累積レイアウトシフト

CLSは、ページの表示中に可視コンテンツが予期せず移動する程度を測定します。時間単位を持たない唯一の指標です：

```js
// CLSを測定
let clsValue = 0;
let clsEntries = [];
let sessionValue = 0;
let sessionEntries = [];

const clsObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // recentInput（ユーザーの最近の入力）がないシフトのみが対象
    if (!entry.hadRecentInput) {
      const firstSessionEntry = sessionEntries[0];
      const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

      // 現在のセッションが前回のシフトから1秒以内かつ合計5秒以内の場合、同じセッションとみなす
      if (
        firstSessionEntry &&
        entry.startTime - lastSessionEntry.startTime < 1000 &&
        entry.startTime - firstSessionEntry.startTime < 5000
      ) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        sessionValue = entry.value;
        sessionEntries = [entry];
      }

      if (sessionValue > clsValue) {
        clsValue = sessionValue;
        clsEntries = sessionEntries;
        console.log('CLS:', clsValue);
      }
    }
  }
});

clsObserver.observe({ type: 'layout-shift', buffered: true });
```

CLSの評価基準：
- 良好：<= 0.1
- 改善が必要：0.1 - 0.25
- 不良：> 0.25

よくあるレイアウトシフトの原因と解決策：

```html
<!-- 1. 画像に幅と高さを設定 -->
<!-- 悪い例：サイズ指定なし、画像読み込み後にコンテナが広がる -->
<img src="photo.jpg" alt="照片">

<!-- 良い例：事前に幅と高さを指定 -->
<img src="photo.jpg" alt="照片" width="800" height="600">

<!-- 2. 動画/iframe/広告のスペースを確保 -->
<div style="aspect-ratio: 16/9;">
  <video src="video.mp4"></video>
</div>

<!-- 3. 既存のコンテンツの上に新しいコンテンツを挿入しない -->
<!-- 悪い例：bannerを動的に挿入すると下のコンテンツが押し下げられる -->
<!-- 良い例：固定高さの予約領域を使用 -->

<!-- 4. CSS containプロパティで影響範囲を制限 -->
<style>
.ad-container {
  contain: layout;
  min-height: 250px; /* 広告スペースの高さを予約 */
}
</style>
```

## 総合的な計測ソリューション

`web-vitals`ライブラリを使用すると、すべてのコア指標を簡単に収集できます：

```bash
npm install web-vitals
```

```js
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    delta: metric.delta,
    // カスタムデータ
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  });

  // Beacon APIを使用してデータを送信
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

## DevToolsでの計測

Chrome DevToolsにはさまざまな測定ツールが用意されています：

1. **Lighthouse**：Performanceパネルから直接Lighthouse監査を実行
2. **Performanceパネル**：ページの読み込み過程を記録し、FCP、LCPなどのマークを確認
3. **Performance Monitor**：CPU、メモリ、レイアウトなどの指標をリアルタイム監視

```js
// コード内でカスタムパフォーマンスポイントをマーク
performance.mark('my-feature-start');
// ... 何らかの処理を実行
performance.mark('my-feature-end');
performance.measure('my-feature', 'my-feature-start', 'my-feature-end');

const measures = performance.getEntriesByName('my-feature');
console.log('所要時間:', measures[0].duration.toFixed(2), 'ms');
```

## まとめ

- FCPは最初のコンテンツが表示される時間を測定し、初期読み込み速度を反映します
- LCPは最大のコンテンツ要素の描画時間を測定し、ユーザーの体感により近い指標です
- FIDは最初のインタラクションの遅延を測定し、ページの応答性を反映します
- CLSはレイアウトシフトの累積度合いを測定し、視覚的安定性を反映します
- 長いタスクの分割、画像サイズの事前指定、フォントの最適化は一般的なパフォーマンス手法です
- `web-vitals`ライブラリを使用すると、すべてのコア指標を簡単に収集および報告できます
- DevToolsのPerformanceパネルとLighthouseは、パフォーマンスデバッグの主要なツールです
