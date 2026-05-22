---
title: "Edge Rendering Patterns: 2025 Practice Summary"
date: 2025-10-12 19:06:43
tags:
  - Frontend
readingTime: 2
description: "Edge 渲染已经从概念验证走向生产应用。来总结一下我们团队在 Edge 渲染方面的实践和踩坑经验。"
wordCount: 172
---

Edge 渲染已经从概念验证走向生产应用。来总结一下我们团队在 Edge 渲染方面的实践和踩坑经验。

## Edge 渲染模式对比

```
模式              首屏速度   动态内容   复杂度   成本
───────────────────────────────────────────────────
纯静态 SSG        最快      不支持     低      最低
Edge SSR          快        支持       中      中
Edge Streaming    快        支持       中高    中
Server Components 快        支持       高      中
混合模式          快        支持       高      灵活
```

## Edge SSR 实战

```ts
// middleware.ts — Next.js Edge Middleware
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 运行在 Edge Runtime（V8 isolate，不是 Node.js）
export function middleware(request: NextRequest) {
  const country = request.geo?.country ?? "CN";
  const language = request.headers.get("accept-language") ?? "zh-CN";

  // Edge 层做 A/B 测试分流
  const abGroup =
    request.cookies.get("ab-group")?.value ?? assignGroup(request);

  // Edge 层做个性化重定向
  if (country === "JP" && !request.nextUrl.pathname.startsWith("/ja")) {
    return NextResponse.redirect(
      new URL(`/ja${request.nextUrl.pathname}`, request.url),
    );
  }

  // 注入请求头，传递给 Server Components
  const response = NextResponse.next();
  response.headers.set("x-ab-group", abGroup);
  response.headers.set("x-user-country", country);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## Edge Streaming

```tsx
// app/products/page.tsx — 流式渲染
import { Suspense } from "react";

// 快速部分：立即返回
export default function ProductsPage() {
  return (
    <div>
      <h1>产品列表</h1>
      <ProductFilters />

      {/* 慢查询用 Suspense 包裹，流式返回 */}
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>

      {/* 推荐数据也是异步的 */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  );
}

// 产品列表：在 Edge 上执行数据库查询
async function ProductList() {
  // 这个函数在 Edge Runtime 上执行
  const products = await db.product.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// 推荐数据：调用远程 API
async function Recommendations() {
  const recommendations = await fetch(
    "https://api.example.com/recommendations",
    {
      next: { revalidate: 3600 }, // 1 小时缓存
    },
  ).then((r) => r.json());

  return (
    <section>
      <h2>为你推荐</h2>
      <RecommendationList items={recommendations} />
    </section>
  );
}
```

## Edge 数据缓存策略

```ts
// lib/edge-cache.ts
// Edge 上的多级缓存

interface CacheConfig {
  staleWhileRevalidate: number; // 后台刷新时间
  maxAge: number; // 缓存有效期
  tags: string[]; // 缓存标签（用于按标签失效）
}

// 方案 1：Next.js fetch 缓存
const products = await fetch("https://api.example.com/products", {
  next: {
    revalidate: 60, // 60 秒后重新验证
    tags: ["products"], // 可通过 revalidateTag("products") 失效
  },
});

// 方案 2：KV 缓存（Cloudflare Workers KV / Vercel KV）
import { kv } from "@vercel/kv";

async function getCachedProducts() {
  const cacheKey = "products:all";

  // 先查缓存
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  // 缓存未命中，查数据库
  const products = await db.product.findMany();
  await kv.set(cacheKey, products, { ex: 60 });

  return products;
}

// 方案 3：Edge Config（只读配置，毫秒级读取）
import { get } from "@vercel/edge-config";

async function getFeatureFlags() {
  // Edge Config 的读取延迟 < 1ms
  const flags = await get("feature-flags");
  return flags;
}
```

## Edge 的限制和坑

```
Edge Runtime 限制：
  1. 不支持 Node.js API（fs、crypto 需要 Web Crypto 替代）
  2. 内存限制（通常 128MB）
  3. 执行时间限制（通常 30 秒）
  4. 不支持某些 npm 包（依赖 Node.js 内置模块的）

踩坑记录：
  1. Prisma 在 Edge 上需要特殊配置（driver adapters）
  2. 某些日期库（如 moment）不兼容，改用 date-fns 或 Intl
  3. 图片处理需要调用外部服务，不能用 sharp
  4. 调试困难，日志不完整
```

```ts
// Edge 兼容的 Prisma 配置
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

// lib/db.ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
```

## 混合渲染策略

```
我们的渲染策略：

  /（首页）           → Edge SSR + Streaming
  /products（列表）    → Edge SSR + 缓存
  /products/[id]（详情）→ Edge SSR + ISR（1 小时）
  /dashboard（后台）   → Client-side（纯 SPA）
  /blog（博客）        → SSG（构建时生成）
  /api/*（接口）       → Edge Functions

根据页面特性选择渲染模式，不是所有页面都需要 Edge SSR。
```

## Summary

- Edge 渲染适合需要低延迟首屏的公开页面
- Streaming SSR 是 Edge 渲染的核心模式，让快的部分先到
- 缓存策略是 Edge 渲染的关键，多级缓存降低源站压力
- Edge Runtime 有 Node.js API 限制，选库时要注意兼容性
- 混合渲染模式是生产环境的最优解，按页面特性选择
