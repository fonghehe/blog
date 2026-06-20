---
title: "Core Web Vitals 2026 新指標と最適化戦略"
date: 2026-06-20 10:23:20
tags:
  - パフォーマンス
readingTime: 2
description: "Core Web Vitals は 2026 年に INP 指標を更新し、FID を置き換えた。新しい評価基準、測定ツール、最適化戦略を議論し、ユーザーエクスペリエンスと検索ランキングの向上を支援する。"
wordCount: 369
---

Core Web Vitals は Google がユーザーエクスペリエンスを測るコア指標で、検索ランキングに直接影響する。2026 年の指標体系は安定し、INP（Interaction to Next Paint）が FID を正式に置き換え、主要なインタラクション応答指標となった。

## 2026 年のコア指標

| 指標 | 略称 | 良好 | 改善必要 | 悪い |
|------|------|------|----------|------|
| Largest Contentful Paint | LCP | ≤2.5s | 2.5-4s | >4s |
| Interaction to Next Paint | INP | ≤200ms | 200-500ms | >500ms |
| Cumulative Layout Shift | CLS | ≤0.1 | 0.1-0.25 | >0.25 |

## LCP 最適化

LCP はメインコンテンツのロード時間を測定する：

```html
<!-- 最適化前 -->
<img src="hero.jpg" />

<!-- 最適化後 -->
<img src="hero.jpg" 
     fetchpriority="high"
     width="1200"
     height="600"
     alt="Hero image" />
```

LCP 最適化戦略：

**戦略 1：クリティカルリソースのプリロード**

```html
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preload" href="/hero.jpg" as="image" />
  <link rel="preload" href="/font.woff2" as="font" crossorigin />
</head>
```

## INP 最適化

INP はインタラクション応答時間を測定し、3 段階を含む：

```javascript
// 1. 入力遅延（Input Delay）
// ユーザー入力からイベントハンドラ実行開始までの時間
button.addEventListener('click', () => {
  // ここで実行が遅いと入力遅延が増加
});

// 2. 処理時間（Processing Time）
// イベントハンドラの実行時間
function handleClick() {
  const result = heavyComputation();
}

// 3. 表示遅延（Presentation Delay）
// ハンドラ実行完了から次のフレームレンダリングまでの時間
```

INP 最適化戦略：

**戦略 1：メインスレッドのブロックを削減**

```javascript
// 悪い例：同期的な長時間タスク
function processLargeDataset(data) {
  for (let i = 0; i < data.length; i++) {
    heavyOperation(data[i]);
  }
}

// 良い例：チャンク処理
async function processLargeDataset(data) {
  const chunkSize = 100;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    chunk.forEach(item => heavyOperation(item));
    
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

## CLS 最適化

CLS はレイアウトシフトを測定し、安定性を維持する目標：

```css
/* 画像と広告のスペースを確保 */
img, video {
  max-width: 100%;
  height: auto;
  aspect-ratio: 16/9;
}

/* フォント読み込みがレイアウトに影響しない */
@font-face {
  font-family: 'CustomFont';
  src: url('/font.woff2') format('woff2');
  font-display: swap;
}
```

## 測定ツール

**Web Vitals ライブラリ**

```javascript
import { onLCP, onINP, onCLS } from 'web-vitals';

function sendToAnalytics({ name, delta, id }) {
  console.log(`${name}: ${delta} (${id})`);
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
```

## まとめ

Core Web Vitals 2026 のコアは LCP、INP、CLS だ。LCP はクリティカルリソースのロードを最適化し、INP はインタラクション応答を最適化し、CLS はレイアウトの安定性を維持する。最適化は一度きりの作業ではなく、継続的な監視と改善が必要だ。
