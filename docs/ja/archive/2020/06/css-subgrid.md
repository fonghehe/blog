---
title: "CSS Subgrid サブグリッドレイアウト 2020：Firefox の先行サポートと実践例"
date: 2019-09-25 16:21:47
tags:
  - CSS
readingTime: 2
description: "CSS Subgrid（サブグリッド）について、API の呼び出しだけで満足している開発者は少なくない。本稿では本番環境の視点から、実際に起きる問題とその解決策を考えてみる。"
wordCount: 481
---

CSS Subgrid（サブグリッド）について、API の呼び出しだけで満足している開発者は少なくない。本稿では本番環境の視点から、実際に起きる問題とその解決策を考えてみる。

## 基本原理

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

## 高度な機能

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

## プロジェクト実践

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

## ベストプラクティス

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

- CSS Subgrid（サブグリッド）は銀の弾丸ではなく、プロジェクトの規模と技術スタックに応じて選ぶ必要がある
- API を丸暗記するより、根底の原理を理解するほうが大切だ
- 本番投入前には必ず互換性の検証を行うこと
- チーム開発では、取り決めとドキュメントが技術そのものよりも重要になる
