---
title: "Next.js 17 新特性展望"
date: 2026-01-27 10:00:00
tags:
  - React
---

Next.js 17 在 2025 年底发布，带来了几个底层架构的重大变化。最核心的转变是 Turbopack 正式取代 Webpack 成为默认构建器、以及新的 PPR（Partial Prerendering）稳定版。对于大型项目来说，这些变化的影响是实质性的。

## Turbopack：终于告别 Webpack

Turbopack 经历了 3 年的开发和打磨，终于在 Next.js 17 中成为默认构建器。对于我们 200+ 页面的项目，冷启动时间从 Webpack 的 45 秒降到了 3 秒以内。

```typescript
// next.config.ts —— Next.js 17 配置
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Turbopack 现在是默认值，不需要手动开启
  // 但你可以配置 Turbopack 特有的选项
  turbopack: {
    // 自定义 loader
    loaders: {
      '.svg': ['@svgr/webpack'],
    },
    // 解析别名
    resolveAlias: {
      '@': './src',
      '@components': './src/components',
    },
    // Turbopack 的模块联邦支持
    moduleFederation: {
      name: 'host',
      remotes: {
        checkout: 'checkout@https://checkout.example.com/remote.js',
      },
    },
  },

  // 实验性特性
  experimental: {
    // React Compiler 深度集成
    reactCompiler: true,
    // 边缘中间件的 AI 推理支持
    aiMiddleware: true,
  },
};

export default config;
```

## PPR（Partial Prerendering）稳定版

PPR 是 Next.js 17 最重要的特性。它让一个页面的不同部分可以有不同的渲染策略：静态部分预渲染成 HTML，动态部分用 Suspense 流式注入。这结合了 SSG 的速度和 SSR 的动态性。

```tsx
// app/product/[id]/page.tsx
import { Suspense } from 'react';

// 静态部分：构建时预渲染，CDN 缓存
function ProductHeader({ product }: { product: Product }) {
  return (
    <header>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p className="text-2xl font-bold">¥{product.price}</p>
    </header>
  );
}

// 动态部分：每次请求实时计算
async function StockStatus({ productId }: { productId: string }) {
  const stock = await fetch(`https://inventory.internal/${productId}`, {
    cache: 'no-store', // 每次请求都查实时库存
  }).then((r) => r.json());

  return (
    <div>
      {stock.available ? (
        <span className="text-green-600">有货，库存 {stock.count} 件</span>
      ) : (
        <span className="text-red-600">暂时缺货</span>
      )}
    </div>
  );
}

// 用户个性化内容：需要鉴权
async function ReviewSection({ productId }: { productId: string }) {
  const user = await getUser();
  const reviews = await getReviews(productId, user?.region);

  return (
    <section>
      <h2>评价 ({reviews.length})</h2>
      {user && <ReviewForm productId={productId} />}
      <ReviewList reviews={reviews} />
    </section>
  );
}

// 页面组装 —— PPR 自动静态/动态分割
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id);

  return (
    <div>
      {/* 这部分在构建时预渲染，壳子立即显示 */}
      <ProductHeader product={product} />

      {/* Suspense 边界：静态壳 + 动态内容 */}
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

Next.js 17 的 Cache API 比以前的 `fetch` 缓存策略更加精细和可控。你可以精确控制每个数据的缓存时间、失效策略、和预热逻辑。

```typescript
// lib/cache.ts
import { unstable_cache } from 'next/cache';
import { revalidateTag } from 'next/cache';

// 精细缓存控制
export const getCachedProduct = unstable_cache(
  async (id: string) => {
    const product = await db.products.findUnique({ where: { id } });
    return product;
  },
  ['product'],
  {
    // 缓存 key 包含动态参数
    tags: ['product'],
    // 精确到秒的缓存时间
    revalidate: 300, // 5 分钟
  }
);

// 在 Server Action 中失效缓存
export async function updateProduct(id: string, data: Partial<Product>) {
  'use server';

  await db.products.update({ where: { id }, data });

  // 精确失效：只刷新这个商品相关的缓存
  revalidateTag(`product-${id}`);

  // 也可以批量失效
  revalidateTag('product-list');
}

// 路由级别的缓存预热
// 在部署后立即预热热门页面
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

## 中间件的增强

中间件在 Next.js 17 中获得了更强的能力，包括直接访问数据库连接、AI 推理调用、以及更灵活的响应构造。

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. 鉴权检查（支持直接查询数据库）
  const session = await verifySession(request.cookies.get('session')?.value);

  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. A/B 测试分流（基于 cookie 持久化）
  const abGroup = request.cookies.get('ab-group')?.value ?? assignABGroup();
  const response = NextResponse.next();
  response.headers.set('x-ab-group', abGroup);

  // 3. 地理位置和语言检测
  const country = request.geo?.country ?? 'CN';
  const preferredLocale = request.headers.get('accept-language')?.slice(0, 2) ?? 'zh';
  response.headers.set('x-locale', country === 'CN' ? 'zh' : preferredLocale);

  // 4. 速率限制（边缘 KV 存储）
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

## 小结

- Turbopack 正式取代 Webpack，大型项目的构建速度提升是数量级的
- PPR 结合了 SSG 的速度和 SSR 的动态性，是 Next.js 最具创新性的特性
- 新的 Cache API 让缓存控制从"全有或全无"变成精确到数据级别的控制
- 中间件能力大幅增强，鉴权、A/B 测试、速率限制可以在边缘完成
- Next.js 17 的趋势：把更多计算推到边缘，同时让开发者的心智模型更简单
