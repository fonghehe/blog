---
title: "フロントエンド開発者が知っておくべきWebアクセシビリティ（a11y）の基礎"
date: 2019-05-26 10:51:45
tags:
  - フロントエンド
readingTime: 2
description: "アクセシビリティ（a11y）は国内のフロントエンド開発でよく見落とされますが、「盲目の人のためだけ」ではありません。キーボードユーザー、色覚障害のユーザー、一時的な障害を持つユーザー（例：腕を骨折して片手しか使えないなど）もアクセシビリティの恩恵を受けます。フロントエンド開発者として、a11yの基礎知識はプロとしての素"
wordCount: 523
---

アクセシビリティ（a11y）は国内のフロントエンド開発でよく見落とされますが、「盲目の人のためだけ」ではありません。キーボードユーザー、色覚障害のユーザー、一時的な障害を持つユーザー（例：腕を骨折して片手しか使えないなど）もアクセシビリティの恩恵を受けます。フロントエンド開発者として、a11yの基礎知識はプロとしての素養の一部です。

## なぜフロントエンドはアクセシビリティに注目すべきか

世界保健機関のデータによると、世界中で約10億人が何らかの障害を持っています。Web開発では：

- 視力障害のユーザーは**スクリーンリーダー**（NVDAやVoiceOverなど）に頼ってWebページを「聴く」
- 運動障害のユーザーはマウスではなく**キーボードナビゲーション**に頼る
- 色覚障害のユーザーは特定の色の組み合わせを区別できない
- 認知障害のユーザーは明確な構造とガイダンスを必要とする

アクセシビリティへの取り組みはこれらのユーザーへのサービスだけでなく、全体的なユーザーエクスペリエンスとSEOも向上させます。

## セマンティックHTMLが最初の防衛線

```html
<!-- 良くない例 -->
<div class="header">
  <div class="nav">
    <span class="nav-item" onclick="goHome()">ホーム</span>
    <span class="nav-item" onclick="goAbout()">アバウト</span>
  </div>
</div>
<div class="main">
  <div class="article">
    <span class="title">記事タイトル</span>
    <div>記事内容...</div>
  </div>
</div>
<div class="footer">著作権情報</div>
```

```html
<!-- 良い例 -->
<header>
  <nav aria-label="メインナビゲーション">
    <ul>
      <li><a href="/">ホーム</a></li>
      <li><a href="/about">アバウト</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h1>記事タイトル</h1>
    <p>記事内容...</p>
  </article>
</main>
<footer>
  <p>&copy; 2019 私のブログ</p>
</footer>
```

スクリーンリーダーは`<header>`、`<nav>`、`<main>`、`<article>`、`<footer>`を使ってページ構造をすばやくナビゲートできます。

## ARIA属性

```html
<!-- ロール -->
<div role="button" tabindex="0" onclick="handleClick()">クリック</div>

<!-- 状態とプロパティ -->
<button aria-expanded="false" aria-controls="menu">メニュー</button>
<ul id="menu" aria-hidden="true">
  <li><a href="/">ホーム</a></li>
</ul>

<!-- ラベル -->
<input type="search" aria-label="記事を検索" />
<img src="logo.png" alt="会社ロゴ" />
```

## キーボードナビゲーション

```css
/* フォーカススタイルを削除しない——キーボードユーザーに必要 */
:focus {
  outline: 2px solid #409eff;
  outline-offset: 2px;
}

/* またはカスタムの視覚的フォーカススタイルを使用 */
:focus-visible {
  outline: 2px solid #409eff;
}
```

セマンティックHTMLから始め、セマンティクスが不十分な場合のみARIAを追加し、常にキーボードでテストする——この3ステップで良いアクセシビリティの80%を達成できます。
