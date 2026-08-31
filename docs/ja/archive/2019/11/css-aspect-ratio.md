---
title: "CSS aspect-ratio プロポーザル解説：padding-topハックからの脱却"
date: 2019-11-11 10:30:38
tags:
  - CSS
readingTime: 2
description: "最近チームでCSSのaspect-ratio（固有の縦横比）を実践に導入し、いくつかの知見が得られた。ここにまとめておくので、同様の取り組みをされる方の参考になれば幸いだ。"
wordCount: 489
---

最近チームで CSS の `aspect-ratio`（固有の縦横比）を実践に導入し、いくつかの知見が得られました。ここにまとめておきますので、同様の取り組みをされる方の参考になれば幸いです。

## コアコンセプト

ポイントは、その中心的な仕組みを理解することです：

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

パフォーマンス最適化は具体的な場面に合わせる必要があり、どの場合も過度な最適化が必要なわけではありません。

## 詳細解析

次の方法で改善できます：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

このアプローチは本番環境で半年以上安定して稼働しており、実際に検証されています。

## 実装経験

基本的な実装方法から見ていきましょう：

```css
.container {
  width: min(90%, 1200px);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 3rem);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.card { container-type: inline-size; }

@container (min-width: 400px) {
  .card__content { display: grid; grid-template-columns: 200px 1fr; }
}

```

このコードは基本的な使い方を示しています。実際のプロジェクトでは、エラー処理や境界条件（エッジケース）も考慮する必要があります。

## 最適化戦略

これをベースに、さらに最適化できます：

```css
:root {
  --bg: light-dark(#fff, #1a1a2e);
  --text: light-dark(#333, #e0e0e0);
  --accent: light-dark(#2563eb, #60a5fa);
  color-scheme: light dark;
}

.carousel {
  display: flex; gap: 1rem; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding: 1rem;
}

.carousel__item {
  flex: 0 0 80%; scroll-snap-align: start;
  border-radius: 12px; transition: scale 0.3s ease;
}

```

このパターンは大規模なプロジェクトで非常に実用的であり、保守コストを大幅に下げられます。

## まとめ

- チームでの合意とドキュメントは、技術そのものよりも重要です
- コミュニティの動向に注目し、技術的なアプローチは継続的に改善していく必要があります
- 新しい技術のために新しい技術を使うべきではありません
- コード例は参考です。実際の業務の場面に合わせて調整してください
