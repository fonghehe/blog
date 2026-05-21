---
title: "CSS View Transitions Level 2：クロスドキュメントアニメーション実践"
date: 2026-03-27 10:00:00
tags:
  - CSS
readingTime: 4
description: "CSS View Transitions Level 1 は、シングルページアプリケーション（SPA）のページ切り替えアニメーションをエレガントなものにしました。そして 2026 年に各主要ブラウザの安定チャンネルに正式搭載された **View Transitions Level 2** は、この機能をマルチページアプ"
wordCount: 800
---

CSS View Transitions Level 1 は、シングルページアプリケーション（SPA）のページ切り替えアニメーションをエレガントなものにしました。そして 2026 年に各主要ブラウザの安定チャンネルに正式搭載された **View Transitions Level 2** は、この機能をマルチページアプリケーション（MPA）にまで拡張しました。JavaScript フレームワーク不要、純粋な CSS + HTML だけで滑らかなクロスドキュメント遷移アニメーションを実現できます。

## Level 1 の復習：SPA でのビュートランジション

これまで SPA フレームワークでは、View Transitions を次のように使うのが一般的でした。

```typescript
// React Router / Next.js のルート切り替えアニメーション
async function navigate(url: string) {
  if (!document.startViewTransition) {
    window.location.href = url;
    return;
  }

  await document.startViewTransition(async () => {
    await router.push(url);
  });
}
```

```css
/* デフォルトのフェードイン・アウト */
::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}
::view-transition-new(root) {
  animation: 200ms ease-in fade-in;
}
```

## Level 2：MPA クロスドキュメント遷移

Level 2 の核心的な突破口は、通常の MPA サイトでもシームレスなナビゲーションアニメーションが実現できる点です。CSS に一行追加するだけです。

```css
/* <head> 内のグローバルスタイルに追加 */
@view-transition {
  navigation: auto; /* 通常のナビゲーションでビュートランジションを有効化 */
}
```

たったこの一行で、すべてのページ遷移に自動的なフェード効果が付与されます。

## 名前付き要素のトランジション：ヒーローアニメーション

Level 2 の最も強力な機能は、クロスドキュメント「ヒーローアニメーション」です。異なるページ間で同じ要素がスムーズに遷移します。

```css
/* 一覧ページ：商品カードに名前を付ける */
.product-card[data-id="42"] {
  view-transition-name: product-42;
}

/* または CSS カスタムプロパティで動的に名前を生成 */
.product-card {
  view-transition-name: var(--product-id);
}
```

```html
<!-- 一覧ページ -->
<div class="product-card" style="--product-id: product-42" data-id="42">
  <img src="product-42.jpg" alt="商品画像" />
  <h2>商品名</h2>
</div>

<!-- 詳細ページ：同じ view-transition-name を使用 -->
<div class="product-hero" style="view-transition-name: product-42">
  <img src="product-42.jpg" alt="商品画像" />
</div>
```

ブラウザは二つの要素の位置・サイズの差異を自動計算し、滑らかな FLIP アニメーションを生成します。

## トランジションアニメーションの細かい制御

```css
/* 特定の名前付き要素に対するトランジション */
::view-transition-old(product-42) {
  animation: 300ms ease-in scale-out;
}
::view-transition-new(product-42) {
  animation: 300ms ease-out scale-in;
}

@keyframes scale-out {
  to {
    transform: scale(1.1);
    opacity: 0;
  }
}
@keyframes scale-in {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
}

/* その他の要素はスライド効果 */
::view-transition-old(root) {
  animation: 250ms ease-out slide-left;
}
::view-transition-new(root) {
  animation: 250ms ease-out slide-right;
}
```

## ユーザーの設定を尊重する

```css
/* ユーザーのアニメーション軽減設定を尊重 */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: auto;
  }

  /* シンプルなフェードに降格、または完全に無効化 */
  ::view-transition-group(*) {
    animation-duration: 0.01ms !important;
  }
}
```

## Next.js / Nuxt への統合

Next.js App Router を例にします。

```typescript
// app/layout.tsx
import './view-transitions.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* Level 2 の MPA モードは CSS で有効化。追加 JS は不要 */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* view-transitions.css */
@view-transition {
  navigation: auto;
}

/* ページレベルのデフォルトアニメーション */
::view-transition-old(root) {
  animation: 200ms ease-out both fade-slide-out;
}
::view-transition-new(root) {
  animation: 200ms ease-out both fade-slide-in;
}

@keyframes fade-slide-out {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

## ブラウザサポート状況（2026 年初頭）

| ブラウザ     | Level 1 | Level 2（クロスドキュメント） |
| ------------ | ------- | ----------------------------- |
| Chrome 133+  | ✅      | ✅                            |
| Firefox 132+ | ✅      | ✅                            |
| Safari 18.3+ | ✅      | ✅                            |
| Edge 133+    | ✅      | ✅                            |

2026 年初頭時点でグローバルのブラウザカバレッジは 92% を超えており、本番環境でも安心して利用できます。`@supports` をプログレッシブエンハンスメントのフォールバックとして使いましょう。

## まとめ

CSS View Transitions Level 2 は、マルチページアプリケーションのアニメーションにおける最後のピースを埋めてくれます。JavaScript フレームワークの介入も、アニメーション状態の手動管理も不要です。わずか数行の CSS 宣言で、ネイティブアプリに匹敵するページ遷移体験をサイトに追加できます。2026 年以降に新規作成する MPA プロジェクトでは、デフォルトで有効にすべき標準機能と言えるでしょう。
