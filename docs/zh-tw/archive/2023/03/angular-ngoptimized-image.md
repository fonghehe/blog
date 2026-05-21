---
title: "Angular NgOptimizedImage 深度實踐：LCP 最佳化從理論到落地"
date: 2023-03-08 10:39:08
tags:
  - Angular
readingTime: 3
description: "Angular 15 內建的 `NgOptimizedImage` 指令是 Angular 官方對 Core Web Vitals 的正式回應。它不只是給 `<img>` 加 `loading=\"lazy\"` 那麼簡單——這篇文章深入探討它在真實專案中的使用方式和背後的最佳化邏輯。"
wordCount: 432
---

Angular 15 內建的 `NgOptimizedImage` 指令是 Angular 官方對 Core Web Vitals 的正式回應。它不只是給 `<img>` 加 `loading="lazy"` 那麼簡單——這篇文章深入探討它在真實專案中的使用方式和背後的最佳化邏輯。

## 快速回顧：NgOptimizedImage 做了什麼

```typescript
import { NgOptimizedImage } from "@angular/common";

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- 使用 ngSrc 替代 src -->
    <img ngSrc="hero-banner.jpg" width="1200" height="600" priority />
  `,
})
export class HeroComponent {}
```

底層最佳化列表：

- **`priority` 圖片**：自動注入 `<link rel="preload">`，提升 LCP
- **非 `priority` 圖片**：自動新增 `loading="lazy"` 和 `decoding="async"`
- **強制尺寸**：要求顯式指定 `width`/`height`，防止 CLS
- **過大圖片警告**：檢測請求圖片尺寸是否遠大於渲染尺寸
- **自動 srcset**：根據常見螢幕密度生成多種尺寸

## CDN Loader 配置

`NgOptimizedImage` 與 CDN 整合後效果最好——它會生成正確的 CDN URL 來請求合適尺寸的圖片：

```typescript
// app.config.ts（Standalone 應用）
import { provideImgixLoader } from "@angular/common"; // 或其他 CDN

bootstrapApplication(AppComponent, {
  providers: [
    // Imgix
    provideImgixLoader("https://my-bucket.imgix.net"),

    // Cloudinary
    // provideCloudinaryLoader('https://res.cloudinary.com/my-cloud'),

    // Cloudflare Images
    // provideImageKitLoader('https://ik.imagekit.io/my-id'),
  ],
});
```

配置後，`ngSrc="products/hero.jpg"` 會自動變成：

```html
<!-- 自動生成適合不同螢幕的 srcset -->
<img
  src="https://my-bucket.imgix.net/products/hero.jpg?w=1200&auto=format"
  srcset="
    https://my-bucket.imgix.net/products/hero.jpg?w=600&auto=format   600w,
    https://my-bucket.imgix.net/products/hero.jpg?w=960&auto=format   960w,
    https://my-bucket.imgix.net/products/hero.jpg?w=1200&auto=format 1200w
  "
  loading="eager"
  fetchpriority="high"
/>
```

## 自定義 CDN Loader

對於私有 CDN 或物件儲存，可以實現自定義 loader：

```typescript
// providers/image-loader.provider.ts
import { IMAGE_LOADER, ImageLoaderConfig } from "@angular/common";

// 假設 CDN 格式：https://cdn.example.com/image/width,height/path
export const customCdnLoader = {
  provide: IMAGE_LOADER,
  useValue: (config: ImageLoaderConfig) => {
    const { src, width } = config;
    if (!width) return `https://cdn.example.com/${src}`;
    return `https://cdn.example.com/resize,w_${width}/${src}`;
  },
};

// 註冊
bootstrapApplication(AppComponent, {
  providers: [customCdnLoader],
});
```

## 響應式圖片與 sizes 屬性

```typescript
@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <!-- 商品列表：移動端全寬，桌面端 33vw -->
    <img
      ngSrc="products/{{ product.slug }}.jpg"
      width="400"
      height="400"
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      [alt]="product.name"
    />

    <!-- 對話方塊中的圖片（固定 300px） -->
    <img
      ngSrc="avatars/{{ user.id }}.jpg"
      width="300"
      height="300"
      sizes="300px"
      [alt]="user.name"
    />
  `,
})
export class ProductCardComponent {
  product!: Product;
  user!: User;
}
```

## 佔位圖與漸進載入

```typescript
@Component({
  standalone: true,
  imports: [NgOptimizedImage, NgIf],
  template: `
    <div class="image-wrapper">
      <!-- 使用 LQIP（低質量圖片佔位）-->
      <img
        ngSrc="articles/{{ article.cover }}"
        width="800"
        height="450"
        [placeholder]="true"
        placeholderConfig="{ blur: 20 }"
        [alt]="article.title"
      />
    </div>
  `,
})
export class ArticleCardComponent {
  article!: Article;
}
```

## 實際 LCP 提升資料

在一個典型的商品列表頁（桌面端，首屏 9 張商品圖）：

| 指標       | 最佳化前 | 最佳化後（NgOptimizedImage + Imgix） |
| 
---------- | ------ | ---------------------------------- |
| LCP        | 3.8s   | 1.6s                               |
| CLS        | 0.12   | 0.01                               |
| 圖片總位元組 | 1.8MB  | 420KB                              |

LCP 提升的主要原因：`priority` 圖片的 `<link rel="preload">` 讓瀏覽器在 HTML 解析階段就開始下載 LCP 圖片，而不是等到渲染樹構建完成。

## 常見問題排查

```typescript
// 警告：Image with src "..." has a ratio mismatch
// 原因：width/height 比例與實際圖片不符
// 解決：設定正確的寬高比，或使用 fill 模式

// fill 模式（適合不知道尺寸的場景）
<div style="position: relative; width: 100%; height: 300px;">
  <img ngSrc="cover.jpg" fill [alt]="title" />
</div>
```

## 總結

`NgOptimizedImage` 將圖片最佳化的最佳實踐內建到框架層——開發者不再需要手動處理 srcset、preload hint、lazy loading。對 LCP 指標有要求的專案（電商、內容類），配合 CDN Loader 使用，是目前 Angular 中改善 Core Web Vitals 成本最低的方案。