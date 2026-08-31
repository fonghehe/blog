---
title: "CSSの印刷最適化テクニック"
date: 2020-06-17 11:16:21
tags:
  - CSS
readingTime: 2
description: "日々の業務でCSS の印刷最適化テクニックは頻繁に使うので、体系的なまとめとして整理した。理解と活用の一助になれば幸いだ。"
wordCount: 328
---

日々の業務で CSS の印刷最適化テクニックをよく使うので、体系的にまとめておく。皆さんの理解と活用の助けになれば幸いだ。

## 基本概念

実際のサンプルを示す。

```css
:root {
  --primary: #2563eb;
  --surface: #f8fafc;
  --text: #1e293b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.component {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1rem, 3vw, 2rem);
  color: var(--text);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1e293b;
    --text: #f1f5f9;
  }
}

```

実際のプロジェクトでは、個別の要件に合わせて適宜調整すること。

## コア実装

中心となるコードは以下の通りだ。

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  container-type: inline-size;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

@container (min-width: 400px) {
  .card__body {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

```

境界条件や異常系の処理をしっかり扱うこと。

## 実践応用

このように実装できる。

```css
:root {
  --primary: #2563eb;
  --surface: #f8fafc;
  --text: #1e293b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.component {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: clamp(1rem, 3vw, 2rem);
  color: var(--text);
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1e293b;
    --text: #f1f5f9;
  }
}

```

このパターンで、コードの保守性が向上する。

## ベストプラクティス

具体的な使い方は以下のコードを参照。

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  container-type: inline-size;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

@container (min-width: 400px) {
  .card__body {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
  }
}

```

チーム内で規約を統一し、揺れを減らすことを推奨する。

## まとめ

- 実際のプロジェクトでは、最新技術を追うよりも適切なアプローチを選ぶほうが重要だ
- チーム開発ではコードスタイルを揃え、保守コストを下げる
- コミュニティの動向を絶えず追い、技術選択を適宜アップデートする
