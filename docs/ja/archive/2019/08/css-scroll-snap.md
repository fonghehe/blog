---
title: "CSS Scroll Snap：スクロールスナップ効果"
date: 2019-08-19 10:44:46
tags:
  - CSS
readingTime: 6
description: "画像カルーセル、全画面スクロールページ、横スクロールカード——これらの一般的なインタラクティブ効果は、これまで JavaScript ライブラリに依存する必要がありました。CSS Scroll Snap プロパティを使用すると、純粋な CSS でスクロールスナップ効果を実現でき、パフォーマンスが向上し、コードもより簡潔になります。2019 年には Scroll Snap は主要ブラウザで広くサポートされました。この記事では Scroll Snap の使い方を体系的に解説します。"
wordCount: 1117
---

画像カルーセル、全画面スクロールページ、横スクロールカード——これらの一般的なインタラクティブ効果は、これまで JavaScript ライブラリに依存する必要がありました。CSS Scroll Snap プロパティを使用すると、純粋な CSS でスクロールスナップ効果を実現でき、パフォーマンスが向上し、コードもより簡潔になります。2019 年には、Scroll Snap は主要ブラウザで広くサポートされました。この記事では Scroll Snap の使用方法と実践的なケースを体系的に説明します。

## コアコンセプト

Scroll Snap は次の 2 つの重要なプロパティで構成されます：

- **`scroll-snap-type`** — スクロールコンテナに設定し、スクロール軸とスナップの厳格さを定義します
- **`scroll-snap-align`** — 子要素に設定し、スナップ位置を定義します

## 基本的な使い方：横スクロールカルーセル

```html
<div class="carousel">
  <div class="slide slide-1">Slide 1</div>
  <div class="slide slide-2">Slide 2</div>
  <div class="slide slide-3">Slide 3</div>
  <div class="slide slide-4">Slide 4</div>
</div>
```

```css
.carousel {
  display: flex;
  overflow-x: auto;
  /* スクロールスナップの設定 */
  scroll-snap-type: x mandatory;
  /* スクロールバーを非表示（オプション） */
  -webkit-overflow-scrolling: touch;
  /* スムーズスクロール */
  scroll-behavior: smooth;
}

/* スクロールバーを非表示にするがスクロール機能は維持 */
.carousel::-webkit-scrollbar {
  display: none;
}

.slide {
  /* 各スライドが画面いっぱいに表示 */
  min-width: 100vw;
  height: 100vh;
  /* スナップ位置の設定 */
  scroll-snap-align: start;
  /* コンテンツの中央揃え */
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.slide-1 { background: #ff6b6b; color: white; }
.slide-2 { background: #4ecdc4; color: white; }
.slide-3 { background: #45b7d1; color: white; }
.slide-4 { background: #96ceb4; color: white; }
```

### scroll-snap-type 詳細

```css
/* 構文 */
scroll-snap-type: <axis> <strictness>;

/* axis: x | y | block | inline | both */
scroll-snap-type: x;       /* 水平方向 */
scroll-snap-type: y;       /* 垂直方向 */
scroll-snap-type: both;    /* 両方向 */
scroll-snap-type: block;   /* ブロック方向（writing-mode に関連） */
scroll-snap-type: inline;  /* インライン方向 */

/* strictness: none | proximity | mandatory */
scroll-snap-type: x mandatory;   /* 厳格スナップ、スナップポイントに必ず揃える */
scroll-snap-type: x proximity;   /* 緩やかスナップ、なるべく揃えるが強制しない */
```

- **`mandatory`** — スクロール停止時にスナップポイントに必ず揃えます。カルーセルや全画面スクロールなどの精密なシーンに適しています
- **`proximity`** — スクロール停止時になるべく揃えますが、位置が不十分な場合は強制調整しません。長いリストなどの自然なスクロールシーンに適しています

### scroll-snap-align 詳細

```css
/* 構文 */
scroll-snap-align: <alignment>;

/* alignment: none | start | center | end | <value> <value> */
scroll-snap-align: start;    /* 子要素の開始辺をコンテナの開始辺に揃える */
scroll-snap-align: center;   /* 子要素の中心をコンテナの中心に揃える */
scroll-snap-align: end;      /* 子要素の終了辺をコンテナの終了辺に揃える */
scroll-snap-align: start end; /* 1つ目：インライン方向、2つ目：ブロック方向 */
```

## フルスクリーンスクロールページ

```html
<div class="fullpage-scroll">
  <section class="section" id="home">ホーム</section>
  <section class="section" id="about">概要</section>
  <section class="section" id="work">作品</section>
  <section class="section" id="contact">お問い合わせ</section>
</div>
```

```css
.fullpage-scroll {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
}

.section {
  height: 100vh;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

#home { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
#about { background: linear-gradient(135deg, #f093fb, #f5576c); color: white; }
#work { background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; }
#contact { background: linear-gradient(135deg, #43e97b, #38f9d7); color: white; }
```

## カードリストのスナップ

商品展示や記事一覧などのシーンに適しています：

```html
<div class="card-container">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
  <div class="card">Card 4</div>
  <div class="card">Card 5</div>
</div>
```

```css
.card-container {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 20px;
  scroll-snap-type: x proximity;  /* 緩やかなスナップ */
  /* 端のカードも中央に表示できるようにする */
  scroll-padding: 0 calc(50% - 150px);
}

.card {
  min-width: 300px;
  height: 200px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  scroll-snap-align: center;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  transition: transform 0.3s;
}

.card:hover {
  transform: scale(1.02);
}
```

## scroll-snap-stop：スクロール通過の制御

デフォルトでは、高速スワイプで複数のスナップポイントをスキップする可能性があります。`scroll-snap-stop` でこの動作を制御できます：

```css
.slide {
  scroll-snap-align: start;
  /* normal: スキップを許可 | always: 毎回必ず停止 */
  scroll-snap-stop: always;
}
```

このプロパティは、ユーザーがページを順に読む必要があるシーン（チュートリアルなど）に特に適しています。

## scroll-padding と scroll-margin

### scroll-padding（コンテナに設定）

スクロールコンテナにパディングを設定します。レイアウトには影響しませんが、スナップ位置に影響します：

```css
/* 固定ナビゲーションバーがある場合、コンテンツが隠れないようにする */
.fullpage-scroll {
  scroll-snap-type: y mandatory;
  scroll-padding-top: 60px; /* ナビゲーションバーの高さ */
}

.section {
  scroll-snap-align: start;
}
```

### scroll-margin（子要素に設定）

個々の子要素にマージンを設定します：

```css
.section {
  scroll-snap-align: start;
  scroll-margin-top: 60px; /* このセクションのみ上部にオフセット */
}
```

## 実践：画像ギャラリー

```html
<div class="gallery">
  <div class="gallery-item">
    <img src="photo1.jpg" alt="写真1">
  </div>
  <div class="gallery-item">
    <img src="photo2.jpg" alt="写真2">
  </div>
  <div class="gallery-item">
    <img src="photo3.jpg" alt="写真3">
  </div>
</div>
```

```css
.gallery {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 10px;
  padding: 10px;
  scroll-padding: 10px;
}

.gallery-item {
  scroll-snap-align: center;
  scroll-snap-stop: always;
  flex: 0 0 auto;
  border-radius: 8px;
  overflow: hidden;
}

.gallery-item img {
  height: 300px;
  width: auto;
  object-fit: cover;
  display: block;
}
```

## 縦コンテンツナビゲーション

サイドナビゲーションと組み合わせて、クリックによる自動スクロールを実現します：

```html
<div class="layout">
  <nav class="side-nav">
    <a href="#section1">第1節</a>
    <a href="#section2">第2節</a>
    <a href="#section3">第3節</a>
  </nav>
  <main class="content">
    <section id="section1">コンテンツ1</section>
    <section id="section2">コンテンツ2</section>
    <section id="section3">コンテンツ3</section>
  </main>
</div>
```

```css
.content {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y proximity;
  scroll-behavior: smooth;
}

section {
  min-height: 100vh;
  scroll-snap-align: start;
  padding: 40px;
  border-bottom: 1px solid #eee;
}
```

## ブラウザ互換性

2019年8月時点のサポート状況：

- Chrome 69+ — 完全対応
- Firefox 68+ — 完全対応
- Safari 11+ — 完全対応（`-webkit-` プレフィックスが必要）
- Edge 79+ — 完全対応
- IE — 未対応

サポートしていないブラウザには、プログレッシブエンハンスメントを追加できます：

```css
@supports (scroll-snap-type: x mandatory) {
  .carousel {
    scroll-snap-type: x mandatory;
  }
  .slide {
    scroll-snap-align: start;
  }
}

/* サポートしていないブラウザでもスクロールは通常通り使用できますが、スナップ効果はありません */
```

## まとめ

- `scroll-snap-type` はコンテナに設定し、スクロール軸とスナップの厳格さを定義します。`scroll-snap-align` は子要素に設定し、スナップ位置を定義します
- `mandatory` の厳格なスナップはカルーセルなどの精密なシーンに、`proximity` の緩やかなスナップはリストなどの自然なスクロールシーンに適しています
- `scroll-snap-stop: always` は高速スワイプ時のコンテンツスキップを防ぎます
- `scroll-padding` と `scroll-margin` は固定ナビゲーションバーなどのオフセットシーンに対応します
- `@supports` を使用してプログレッシブエンハンスメントを行い、サポートしていないブラウザでもスクロール機能は通常通り使用できます
- 純粋な CSS で実装され、パフォーマンスは JavaScript 方式よりも優れているため、新プロジェクトでの優先的な使用を推奨します
