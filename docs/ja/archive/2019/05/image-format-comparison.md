---
title: "フロントエンド画像フォーマット比較：WebP"
date: 2019-05-23 16:31:17
tags:
  - フロントエンド
readingTime: 1
description: "適切な画像フォーマットの選択はフロントエンド開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。"
---

適切な画像フォーマットの選択はフロントエンド開発でよく直面する問題です。本記事では実際のプロジェクトをベースに、具体的な実装方法と経験からの知見を紹介します。

## フォーマット概要

| フォーマット | 最適な用途                   | 圧縮方式     | 透過 | アニメーション |
| ------------ | ---------------------------- | ------------ | ---- | -------------- |
| JPEG         | 写真                         | 非可逆       | なし | なし           |
| PNG          | アイコン、スクリーンショット | 可逆         | あり | なし           |
| GIF          | シンプルなアニメーション     | 可逆         | あり | あり           |
| WebP         | 全般                         | 両方         | あり | あり           |
| AVIF         | 全般                         | WebPより優秀 | あり | あり           |

## WebP

Googleが開発したWebPは、同等品質でJPEGより25〜34%、透過のあるPNGより26%ファイルサイズが小さくなります。

```html
<!-- プログレッシブエンハンスメントのために<picture>を使用 -->
<picture>
  <source srcset="image.webp" type="image/webp" />
  <source srcset="image.jpg" type="image/jpeg" />
  <img src="image.jpg" alt="説明" />
</picture>
```

```javascript
// WebPサポートの検出
function supportsWebP() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src =
      "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
  });
}
```

## レスポンシブ画像

```html
<!-- srcset：ビューポートに基づいて異なるサイズを提供 -->
<img
  src="image-800.jpg"
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 900px) 800px, 1200px"
  alt="レスポンシブ画像"
/>
```

## ビルド時の最適化

```javascript
// webpack：imageminで自動的にWebPに変換
const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");

module.exports = {
  plugins: [
    new ImageMinimizerPlugin({
      minimizerOptions: {
        plugins: [["imagemin-webp", { quality: 75 }]],
      },
    }),
  ],
};
```

一般的なルール：写真や複雑な画像にはWebP、アイコンやイラストにはSVGを使用し、WebPをサポートしないブラウザ向けに常にフォールバックを提供しましょう。
