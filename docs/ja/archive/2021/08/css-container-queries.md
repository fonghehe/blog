---
title: "CSS Container Queries：ブラウザサポートが間近"
date: 2021-08-23 09:48:53
tags:
  - CSS

readingTime: 3
description: "CSS 仕様に関心のある方はすでにお気づきかもしれませんが、Container Queries が Chrome Canary の実験段階に入りました。この機能は数年待たれていたもので、ついに実現しようとしています。"
wordCount: 548
---

CSS 仕様に関心のある方はすでにお気づきかもしれませんが、Container Queries が Chrome Canary の実験段階に入りました。この機能は数年待たれていたもので、ついに実現しようとしています。

## Container Queries とは

Media Queries は**ビューポートの幅**に応じてレスポンシブになりますが、Container Queries は**親コンテナの幅**に応じてレスポンシブになります。

これこそがコンポーネント指向開発に真に必要な能力です。

```css
/* Media Queries：ブラウザウィンドウの幅に応じる */
@media (min-width: 768px) {
  .card { flex-direction: row; }
}

/* Container Queries：親コンテナの幅に応じる */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## なぜこの機能が重要か

現在の課題：同じコンポーネントをサイドバー（狭い）とメインコンテンツエリア（広い）に配置した場合、表示を変えるべきです。しかし Media Queries はビューポートしか見ず、コンテナを見ません。

```html
<!-- 同じ Card コンポーネント -->
<div class="sidebar">
  <Card /> <!-- サイドバーは狭いので、コンパクトなレイアウトを表示すべき -->
</div>

<main>
  <Card /> <!-- メインコンテンツエリアは広いので、完全なレイアウトを表示すべき -->
</main>

<!-- 同じビューポート内の 2 つの Card を Media Queries では区別できない -->
```

## 構文の詳細

```css
/* 1. コンテナを定義 */
.card-container {
  container-type: inline-size;  /* inline 方向（水平）のサイズのみ監視 */
  container-name: card;          /* オプション：コンテナに名前を付ける */
}

/* ショートハンド */
.card-container {
  container: card / inline-size;
}

/* 2. @container クエリを使用 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .card__image {
    aspect-ratio: 1;
  }
}

@container card (min-width: 600px) {
  .card {
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }
}
```

## 実際の事例：レスポンシブカード

```css
.card-wrapper {
  container: card / inline-size;
}

/* 狭いコンテナ：垂直に積み重ね */
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card__title {
  font-size: 1rem;
}

/* 中程度のコンテナ：水平に配置 */
@container card (min-width: 350px) {
  .card {
    flex-direction: row;
    align-items: center;
  }

  .card__image {
    width: 120px;
    flex-shrink: 0;
  }

  .card__title {
    font-size: 1.125rem;
  }
}

/* 広いコンテナ：より大きなレイアウト */
@container card (min-width: 500px) {
  .card {
    gap: 1.5rem;
  }

  .card__image {
    width: 200px;
  }

  .card__title {
    font-size: 1.25rem;
  }
}
```

## 既存ソリューションとの比較

```javascript
// 現在の一般的な方法：ResizeObserver でコンテナの幅を監視
// エレガントではなく、パフォーマンスのオーバーヘッドもある

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = entry.contentRect.width
    entry.target.classList.toggle('compact', width < 400)
    entry.target.classList.toggle('normal', width >= 400 && width < 600)
    entry.target.classList.toggle('wide', width >= 600)
  }
})

document.querySelectorAll('.card-wrapper').forEach((el) => {
  observer.observe(el)
})

// Container Queries なら CSS 1行で完了、ブラウザネイティブで最適化
```

## Tailwind CSS との組み合わせ

Tailwind 3.0 は実験的に `@container` をサポートしています：

```html
<!-- コンテナに container クラスを追加する必要がある -->
<div class="@container">
  <div class="flex @md:flex-row @lg:gap-8">
    <img class="w-full @md:w-32 @lg:w-48" />
    <div class="@md:ml-4">
      <h3 class="text-sm @md:text-lg @lg:text-xl">标题</h3>
    </div>
  </div>
</div>
```

## ブラウザサポートの現状

2021 年 8 月現在：

- Chrome Canary：実験的サポート（flag を有効化する必要あり）
- Chrome 105+：デフォルトでサポート予定
- Firefox / Safari：サポート時期は未定

現時点では PostCSS プラグインでフォールバックできます：

```bash
npm install -D @csstools/postcss-container-queries
```

## まとめ

- Container Queries はコンポーネントが親コンテナの幅に応じてレスポンシブになることを可能にし、Media Queries の根本的な限界を解決する
- 構文：`container-type` でコンテナを定義し、`@container` でクエリを実行
- コンポーネント指向開発に必須の機能、Grid + Container Queries = 真のレスポンシブコンポーネント
- ブラウザサポートはまだ初期段階だが、流れは決まっており、事前に知っておく価値がある
