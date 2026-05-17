---
title: "Webパフォーマンス最適化：2025年の方法論"
date: 2025-05-20 10:00:00
tags:
  - パフォーマンス最適化
readingTime: 2
description: "いくつかのパフォーマンス最適化プロジェクトを経験した後、断片的なテクニックではなく方法論をまとめたいと思います。"
---

いくつかのパフォーマンス最適化プロジェクトを経験した後、断片的なテクニックではなく方法論をまとめたいと思います。

## パフォーマンス最適化の前提：計測

```
計測なき最適化はない。

悪いやり方：
"このページは遅い気がするから最適化しよう"

良いやり方：
"P75のLCPが4.2s、目標は2.5s以内。
 Chrome DevToolsで分析した結果、ボトルネックは画像読み込みとJSのパース"
```

重要指標：

```
Core Web Vitals（ユーザー体験）：
  LCP（Largest Contentful Paint）< 2.5s：最初の主要コンテンツの読み込み完了
  INP（Interaction to Next Paint）< 200ms：FIDの後継
  CLS（Cumulative Layout Shift）< 0.1：ページが飛び跳ねないこと

ビジネス指標：
  TTFB（Time to First Byte）：サーバーレスポンス速度
  TTI（Time to Interactive）：ページがユーザー操作に応答できる時間
  Bundle Size：JSバンドルサイズ
```

## 計測ツール

```javascript
// web-vitalsライブラリで上報
import { onCLS, onINP, onLCP, onTTFB } from "web-vitals";

function sendToAnalytics({ name, value, id, rating }) {
  // rating: 'good' | 'needs-improvement' | 'poor'
  analytics.track("web_vital", {
    metric: name,
    value: Math.round(value),
    id,
    rating,
    page: window.location.pathname,
  });
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

## LCP最適化：最大コンテンツの描画

LCPは通常、ファーストビューの大きな画像や大きなタイトルです。

```html
<!-- 1. 重要な画像をpreloadする -->
<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high" />

<!-- 2. LCP画像に高い優先度を設定する -->
<img
  src="/hero-image.webp"
  fetchpriority="high"
  loading="eager"
  alt="ファーストビュー画像"
/>

<!-- 3. その他の画像は遅延読み込み -->
<img src="/card-image.webp" loading="lazy" alt="カード画像" />
```

```html
<!-- 4. モダンな画像フォーマットを使用する -->
<picture>
  <source type="image/avif" srcset="/hero.avif" />
  <source type="image/webp" srcset="/hero.webp" />
  <img src="/hero.jpg" alt="ファーストビュー" />
</picture>
```

```typescript
// 5. Next.jsでは<Image>コンポーネントを優先的に使用する
import Image from 'next/image'

<Image
  src="/hero.webp"
  width={1200}
  height={600}
  priority  // fetchpriority="high" + preloadと同等
  alt="ファーストビュー画像"
/>
```

## INP最適化：インタラクション応答

INPはFIDの後継で、ユーザーのインタラクションから次のフレームのレンダリングまでの時間を測定します。

```javascript
// 長いタスクはメインスレッドをブロックし、INPを悪化させる
// scheduler.yield()でメインスレッドを譲る（Chrome 115+）

async function processLargeList(items) {
  const CHUNK_SIZE = 50;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    processChunk(chunk);

    // 1バッチ処理するたびにメインスレッドを譲る
    await scheduler.yield();
  }
}

// フォールバック
async function yieldToMain() {
  if ("scheduler" in window && "yield" in scheduler) {
    return scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```

```tsx
// React：startTransitionで優先度の低い更新をマークする
import { startTransition, useState } from "react";

function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  function handleSearch(value: string) {
    setQuery(value); // 緊急：入力欄を即座に更新

    startTransition(() => {
      setResults(search(value)); // 非緊急：中断可能
    });
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      <SearchResults results={results} />
    </>
  );
}
```

## バンドルサイズ最適化

```javascript
// コード分割：ルートレベル（Next.jsが自動実施）

// コンポーネントレベルの遅延読み込み
const HeavyChart = lazy(() => import("./HeavyChart"));

// 条件付き読み込み
const MarkdownEditor = lazy(() =>
  import("./MarkdownEditor").then((m) => ({ default: m.MarkdownEditor })),
);

// 必要になったときだけ読み込む
function Page() {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <>
      <button onClick={() => setEditorOpen(true)}>エディタを開く</button>
      {editorOpen && (
        <Suspense fallback={<div>エディタを読み込み中...</div>}>
          <MarkdownEditor />
        </Suspense>
      )}
    </>
  );
}
```

```javascript
// バンドルサイズを分析する
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}

// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true'
})
module.exports = withBundleAnalyzer({})
```

## 最適化フロー

```
1. ベースラインの確立：Lighthouse CIをCI/CDに組み込んで自動計測
2. リアルデータの収集：web-vitalsで分析プラットフォームに上報
3. ボトルネックの特定：Profiler、Networkウォーターフォール
4. 優先順位付け：最も多くのユーザーに影響し、費用対効果が高いものを優先
5. 修正と検証：A/BテストまたはBefore/Afterデータ比較
6. リグレッション監視：Lighthouse CIに閾値を設定し、悪化したらCIを失敗させる
```

## まとめ

- まず計測する。データなしで最適化の話をしない
- Core Web VitalsはLCP・INP・CLSが2025年の主要指標
- LCP：重要な画像をpreload、モダンフォーマットを使用、ファーストビューの画像を遅延読み込みしない
- INP：長いタスクを避け、scheduler.yield()とstartTransitionでメインスレッドを譲る
- バンドルサイズ：ルートレベルのコード分割＋条件付き遅延読み込み
- パフォーマンステストをCIに組み込んでリグレッションを防ぐ
