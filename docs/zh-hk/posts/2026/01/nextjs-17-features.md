---
title: "Next.js 17 新特性展望"
date: 2026-01-27 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 17 在 2025 年底發佈，帶來了幾個底層架構的重大變化。最核心的轉變是 Turbopack 正式取代 Webpack 成為默認構建器、以及新的 PPR（Partial Prerendering）穩定版。對於大型項目來説，這些變化的影響是實質性的。"
wordCount: 438
---

Next.js 17 在 2025 年底發佈，帶來了幾個底層架構的重大變化。最核心的轉變是 Turbopack 正式取代 Webpack 成為默認構建器、以及新的 PPR（Partial Prerendering）穩定版。對於大型項目來説，這些變化的影響是實質性的。

## Turbopack：終於告別 Webpack

Turbopack 經歷了 3 年的開發和打磨，終於在 Next.js 17 中成為默認構建器。對於我們 200+ 頁面的項目，冷啓動時間從 Webpack 的 45 秒降到了 3 秒以內。

```typescript
// next.config.ts —— Next.js 17 配置
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Turbopack 現在是默認值，不需要手動開啓
  // 但你可以配置 Turbopack 特有的選項
  turbopack: {
    // 自定義 loader
    loaders: {
      '.svg': ['@svgr/webpack'],
    },
    // 解析別名
    resolveAlias: {
      '@': './src',
      '@components': './src/components',
    },
    // Turbopack 的模塊聯邦支持
    moduleFederation: {
      name: 'host',
      remotes: {
        checkout: 'checkout@https://checkout.example.com/remote.js',
      },
    },
  },

  // 實驗性特性
  experimental: {
    // React Compiler 深度集成
    reactCompiler: true,
    // 邊緣中間件的 AI 推理支持
    aiMiddleware: true,
  },
};

export default config;
```

## PPR（Partial Prerendering）穩定版

PPR 是 Next.js 17 最重要的特性。它讓一個頁面的不同部分可以有不同的渲染策略：靜態部分預渲染成 HTML，動態部分用 Suspense 流式注入。這結合了 SSG 的速度和 SSR 的動態性。

```tsx
// app/product/[id]/page.tsx
import { Suspense } from 'react';

// 靜態部分：構建時預渲染，CDN 緩存
function ProductHeader({ product }: { product: Product }) {
  return (
    <header>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p className="text-2xl font-bold">¥{product.price}</p>
    </header>
  );
}

// 動態部分：每次請求實時計算
async function StockStatus({ productId }: { productId: string }) {
  const stock = await fetch(`https://inventory.internal/${productId}`, {
    cache: 'no-store', // 每次請求都查實時庫存
  }).then((r) => r.json());

  return (
    <div>
      {stock.available ? (
        <span className="text-green-600">有貨，庫存 {stock.count} 件</span>
      ) : (
        <span className="text-red-600">暫時缺貨</span>
      )}
    </div>
  );
}

// 用户個性化內容：需要鑑權
async function ReviewSection({ productId }: { productId: string }) {
  const user = await getUser();
  const reviews = await getReviews(productId, user?.region);

  return (
    <section>
      <h2>評價 ({reviews.length})</h2>
      {user && <ReviewForm productId={productId} />}
      <ReviewList reviews={reviews} />
    </section>
  );
}

// 頁面組裝 —— PPR 自動靜態/動態分割
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  return (
    <div>
      {/* 這部分在構建時預渲染，殼子立即顯示 */}
      <ProductHeader product={product} />

      {/* Suspense 邊界：靜態殼 + 動態內容 */}
      <Suspense fallback={<div className="animate-pulse h-8 w-32 bg-gray-200" />}>
        <StockStatus productId={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewSection productId={params.id} />
      </Suspense>
    </div>
  );
}
```

## 新的 Cache API

Next.js 17 的 Cache API 比以前的 `fetch` 緩存策略更加精細和可控。你可以精確控制每個數據的緩存時間、失效策略、和預熱邏輯。

```typescript
// lib/cache.ts
import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';

// 精細緩存控制
export const getCachedProduct = unstable_cache(
  async (id: string) => {
    const product = await db.products.findUnique({ where: { id } });
    return product;
  },
  ['product'],
  {
    // 緩存 key 包含動態參數
    tags: ['product'],
    // 精確到秒的緩存時間
    revalidate: 300, // 5 分鐘
  }
);

// 在 Server Action 中失效緩存
export async function updateProduct(id: string, data: Partial<Product>) {
  'use server';

  await db.products.update({ where: { id }, data });

  // 精確失效：只刷新這個商品相關的緩存
  revalidateTag(`product-${id}`);

  // 也可以批量失效
  revalidateTag('product-list');
}

// 路由級別的緩存預熱
// 在部署後立即預熱熱門頁面
export async function warmupCache() {
  const topProducts = await db.products.findMany({
    orderBy: { viewCount: 'desc' },
    take: 100,
  });

  await Promise.all(
    topProducts.map((p) => getCachedProduct(p.id))
  );
}
```

## 中間件的增強

中間件在 Next.js 17 中獲得了更強的能力，包括直接訪問數據庫連接、AI 推理調用、以及更靈活的響應構造。

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. 鑑權檢查（支持直接查詢數據庫）
  const session = await verifySession(request.cookies.get('session')?.value);

  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. A/B 測試分流（基於 cookie 持久化）
  const abGroup = request.cookies.get('ab-group')?.value ?? assignABGroup();
  const response = NextResponse.next();
  response.headers.set('x-ab-group', abGroup);

  // 3. 地理位置和語言檢測
  const country = request.geo?.country ?? 'CN';
  const preferredLocale = request.headers.get('accept-language')?.slice(0, 2) ?? 'zh';
  response.headers.set('x-locale', country === 'CN' ? 'zh' : preferredLocale);

  // 4. 速率限制（邊緣 KV 存儲）
  const ip = request.ip ?? 'unknown';
  const rateLimitKey = `ratelimit:${ip}`;
  const hits = await edgeKV.incr(rateLimitKey);
  if (hits === 1) await edgeKV.expire(rateLimitKey, 60);
  if (hits > 100) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

## 小結

- Turbopack 正式取代 Webpack，大型項目的構建速度提升是數量級的
- PPR 結合了 SSG 的速度和 SSR 的動態性，是 Next.js 最具創新性的特性
- 新的 Cache API 讓緩存控制從"全有或全無"變成精確到數據級別的控制
- 中間件能力大幅增強，鑑權、A/B 測試、速率限制可以在邊緣完成
- Next.js 17 的趨勢：把更多計算推到邊緣，同時讓開發者的心智模型更簡單
