---
title: "Intersection Observer API 実践ガイド"
date: 2019-07-16 17:28:35
tags:
  - フロントエンド
readingTime: 2
description: "以前は画像の遅延読み込みや無限スクロールの実装には `scroll` イベントと `getBoundingClientRect()` を組み合わせるのが一般的でした。パフォーマンスが悪いだけでなく、コードも煩雑になります。Intersection Observer API の登場でこの状況は一変しました。"
---

以前は画像の遅延読み込みや無限スクロールの実装には `scroll` イベントと `getBoundingClientRect()` を組み合わせるのが一般的でした。パフォーマンスが悪いだけでなく、コードも煩雑になります。Intersection Observer API の登場でこの状況は一変しました。

## 基本的な使い方

Intersection Observer は、ターゲット要素と祖先要素（またはビューポート）の交差状態を非同期で監視できます。

```javascript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      console.log("ターゲット要素:", entry.target);
      console.log("交差しているか:", entry.isIntersecting);
      console.log("交差率:", entry.intersectionRatio);
      console.log("交差矩形:", entry.intersectionRect);
    });
  },
  {
    root: null, // デフォルトはビューポート
    rootMargin: "0px", // ルート要素の外側マージン（CSS margin と同様）
    threshold: 0, // 交差率のしきい値（配列も可: [0, 0.25, 0.5, 0.75, 1]）
  },
);

// 監視開始
observer.observe(targetElement);

// 監視停止
observer.unobserve(targetElement);

// オブザーバーの破棄
observer.disconnect();
```

## 実践1：画像の遅延読み込み

最もよく使われるユースケース：

```html
<div class="image-list">
  <img data-src="https://cdn.example.com/photo1.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo2.jpg" class="lazy" />
  <img data-src="https://cdn.example.com/photo3.jpg" class="lazy" />
</div>
```

```javascript
class LazyLoader {
  constructor(options = {}) {
    this.observer = null;
    this.options = {
      rootMargin: options.rootMargin || "200px", // 200px前から読み込み開始
      threshold: options.threshold || 0,
      placeholder:
        options.placeholder ||
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    };
  }

  observe(images) {
    if (!("IntersectionObserver" in window)) {
      this.loadAllImages(images);
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      },
    );

    images.forEach((img) => {
      if (!img.src) {
        img.src = this.options.placeholder;
      }
      this.observer.observe(img);
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add("loaded");
    };
    tempImg.onerror = () => {
      img.classList.add("error");
    };
    tempImg.src = src;
  }

  loadAllImages(images) {
    images.forEach((img) => this.loadImage(img));
  }
}

// 使い方
const lazyLoader = new LazyLoader({ rootMargin: "300px" });
const images = document.querySelectorAll("img.lazy");
lazyLoader.observe(images);
```

## 実践2：スクロール時のアニメーション表示

```javascript
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        revealObserver.unobserve(entry.target); // 1回だけアニメーション
      }
    });
  },
  { threshold: 0.1 },
);

document.querySelectorAll(".reveal-on-scroll").forEach((el) => {
  revealObserver.observe(el);
});
```

## まとめ

- Intersection Observer は scroll + getBoundingClientRect() を置き換え、パフォーマンスが優れている
- `rootMargin` でビューポートに入る前の「先読み」が可能
- `threshold` でコールバックを発火する交差率を制御できる
- 一回限りの動作の後は `unobserve` でメモリリークを防ぐ
