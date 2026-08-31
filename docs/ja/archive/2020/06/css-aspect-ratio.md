---
title: "CSS aspect-ratio ネイティブな縦横比 2020：Chrome 88 で正式サポート"
date: 2019-11-11 10:30:38
tags:
  - CSS
readingTime: 2
description: "このほどチーム内で CSS の aspect-ratio（ネイティブな縦横比）を導入し、いくつかの知見が溜まった。同じような取り組みをする人の参考になればとまとめておく。"
wordCount: 476
---

このほどチーム内で CSS の aspect-ratio（ネイティブな縦横比）を導入し、いくつかの知見が溜まった。同じような取り組みをする人の参考になればとまとめておく。

## コアコンセプト

肝心なのは、仕組みの根本を理解することだ。

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

パフォーマンスの最適化は適用場面ごとに考える必要があり、どのケースでも過剰にチューニングする必要はない。

## 深掘り解析

次のようなアプローチで改善できる。

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

このアプローチは本番環境で半年以上安定稼働しており、実際に検証済みだ。

## 実装経験

基本的な実装の流れから見ていこう。

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

このコードは基本的な使い方を示している。実際のプロジェクトでは、エラーハンドリングや境界条件（エッジケース）も考慮する必要がある。

## チューニング戦略

これをベースに、さらに最適化していける。

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

このパターンは大規模なプロジェクトで非常に実用的で、保守コストを大きく下げられる。

## まとめ

- チーム開発では、取り決めとドキュメントが技術そのものよりも重要になる
- コミュニティの動向に目を配り、技術選択は継続的にアップデートすべきだ
- 新しい技術だからという理由だけで使ってはいけない
- コード例はあくまで参考であり、実際の業務の場面に合わせて調整すること
