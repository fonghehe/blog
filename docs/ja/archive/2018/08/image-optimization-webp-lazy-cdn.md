---
title: "フロントエンドの画像最適化：WebP、遅延読み込みとCDN"
date: 2018-08-30 11:24:21
tags:
  - パフォーマンス最適化
readingTime: 2
description: "画像はWebページで最も大きなリソースの一つで、総読み込みサイズの60%以上を占めることが多いです。実際のプロジェクトで使った画像最適化方法をまとめます。"
wordCount: 378
---

画像はWebページで最も大きなリソースの一つで、総読み込みサイズの60%以上を占めることが多いです。実際のプロジェクトで使った画像最適化方法をまとめます。

## WebPフォーマット

WebPはGoogleが開発した画像フォーマットで、同じ品質ならJPEGより25〜35%、PNGより26%小さくなります。

**ブラウザのサポートを検出して動的に切り替える：**

```javascript
// WebPのサポートを検出
function checkWebpSupport() {
  return new Promise((resolve) => {
    const webp = new Image();
    webp.onload = webp.onerror = () => resolve(webp.height === 2);
    webp.src =
      "data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA";
  });
}

// index.jsの最初の方で実行
checkWebpSupport().then((supported) => {
  document.documentElement.classList.toggle("webp", supported);
});
```

```css
/* CSSの画像 */
.hero {
  background-image: url("/images/hero.jpg");
}
.webp .hero {
  background-image: url("/images/hero.webp");
}
```

**HTMLのpicture要素（推奨）：**

```html
<picture>
  <source srcset="/images/hero.webp" type="image/webp" />
  <source srcset="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="ヒーロー画像" />
</picture>
```

ブラウザは上から順に最初にサポートされているフォーマットを選択します。

## 画像の遅延読み込み

### ネイティブの方法（新しいブラウザ）

```html
<img loading="lazy" src="/images/photo.jpg" alt="写真" />
```

ブラウザのサポートがまだ十分ではないため、主流の方法は`IntersectionObserver`です：

```javascript
// 遅延読み込みの実装
class LazyLoader {
  constructor(selector = "img[data-src]") {
    this.images = document.querySelectorAll(selector);
    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      rootMargin: "200px 0px", // 200px手前から読み込み開始
    });
    this.init();
  }

  init() {
    this.images.forEach((img) => this.observer.observe(img));
  }

  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    const srcset = img.dataset.srcset;

    if (srcset) img.srcset = srcset;
    if (src) img.src = src;

    img.removeAttribute("data-src");
    img.removeAttribute("data-srcset");
    img.classList.add("loaded");
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  new LazyLoader();
});
```

```html
<!-- srcの代わりにdata-srcを使用 -->
<img
  data-src="/images/photo.jpg"
  data-srcset="/images/photo@2x.jpg 2x"
  src="/images/placeholder.svg"
  alt="写真"
  class="lazy"
/>
```

## レスポンシブ画像

デバイスの幅に基づいて異なるサイズの画像を読み込む：

```html
<!-- sizesは表示幅を記述し、srcsetは異なる幅の画像を提供 -->
<img
  src="/images/photo-400.jpg"
  srcset="
    /images/photo-400.jpg   400w,
    /images/photo-800.jpg   800w,
    /images/photo-1200.jpg 1200w
  "
  sizes="
    (max-width: 600px) 100vw,
    (max-width: 1200px) 50vw,
    33vw
  "
  alt="レスポンシブ写真"
/>
```

## CDNとキャッシュ制御

画像をCDNにアップロードして適切なキャッシュポリシーを設定する：

```nginx
# Nginx：静的リソースの強力なキャッシュ
location ~* \.(jpg|jpeg|png|gif|webp|svg)$ {
  expires 30d;
  add_header Cache-Control "public, immutable";
  add_header Vary Accept;
}
```

キャッシュ問題を避けるためURLにハッシュを付与する：

```javascript
// webpack設定：画像ファイル名にハッシュを追加
module.exports = {
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|webp)$/,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 8192, // 8KB未満はbase64に変換
              name: "images/[name].[hash:8].[ext]",
            },
          },
        ],
      },
    ],
  },
};
```

## 画像の圧縮

ビルド時に自動圧縮する：

```javascript
// webpack：imagemin-webpack-plugin
const ImageminPlugin = require("imagemin-webpack-plugin").default;

module.exports = {
  plugins: [
    new ImageminPlugin({
      test: /\.(jpe?g|png|gif|svg)$/i,
      pngquant: { quality: "65-90" },
      optipng: { optimizationLevel: 5 },
    }),
  ],
};
```

## スケルトンスクリーンとプレースホルダー

読み込み中に低品質な画像（LQIP）を表示する：
