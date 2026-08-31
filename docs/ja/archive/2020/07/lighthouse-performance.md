---
title: "Lighthouse パフォーマンス最適化チェックリスト"
date: 2020-07-29 16:34:33
tags:
  - パフォーマンス最適化
readingTime: 2
description: "最近チームでLighthouse パフォーマンス最適化チェックリストを導入し、かなりの経験を積んだ。同様の作業の参考になれば幸いだ。"
wordCount: 427
---

最近チーム内で Lighthouse のパフォーマンス最適化チェックリストを導入し、多くの経験を積んだ。同様の取り組みを行う人たちの参考になればとまとめた。

## コアコンセプト

まず基本的な実装方法を見てみよう：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

このコードは基本的な使い方を示している。実際のプロジェクトではエラー処理や境界条件も考慮する必要がある。

## 深掘り解析

これをベースにさらに最適化できる：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大幅に下げられる。

## 実装経験

実際のプロジェクトでは使い方はもう少し複雑になる：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

この方法により、コードのテスタビリティと拡張性の両方が向上する。

## チューニング戦略

以下に完全なサンプルを示す：

```javascript
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.entryType === 'largest-contentful-paint') {
      reportMetric('LCP', entry.startTime)
    }
    if (entry.entryType === 'first-input') {
      reportMetric('FID', entry.processingStart - entry.startTime)
    }
  }
})
observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] })

```

境界条件の処理に注意すること。これは本番環境では極めて重要だ。

## まとめ

- Lighthouse のパフォーマンス最適化チェックリストは銀の弾丸ではなく、プロジェクトの規模と技術スタックに応じて選択する必要がある
- API を覚えることよりも、背後にある原理を理解することが重要だ
- 本番環境で使う前には必ず互換性の検証を行うこと
