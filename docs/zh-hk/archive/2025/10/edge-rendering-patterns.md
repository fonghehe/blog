---
title: "Edge 渲染模式：2025 年的實踐總結"
date: 2025-10-12 19:06:43
tags:
  - 前端
readingTime: 2
description: "Edge 渲染已經從概念驗證走向生產應用。來總結一下我們團隊在 Edge 渲染方面的實踐和踩坑經驗。"
wordCount: 173
---

Edge 渲染已經從概念驗證走向生產應用。來總結一下我們團隊在 Edge 渲染方面的實踐和踩坑經驗。

## Edge 渲染模式對比

```
模式              首屏速度   動態內容   複雜度   成本
───────────────────────────────────────────────────
純靜態 SSG        最快      不支持     低      最低
Edge SSR          快        支持       中      中
Edge Streaming    快        支持       中高    中
Server Components 快        支持       高      中
混合模式          快        支持       高      靈活
```

## Edge SSR 實戰

```ts
// middleware.ts — Next.js Edge Middleware
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 運行在 Edge Runtime（V8 isolate，不是 Node.js）
export function middleware(request: NextRequest) {
  const country = request.geo?.country ?? "CN";
  const language = request.headers.get("accept-language") ?? "zh-CN";

  // Edge 層做 A/B 測試分流
  const abGroup =
    request.cookies.get("ab-group")?.value ?? assignGroup(request);

  // Edge 層做個性化重定向
  if (country === "JP" && !request.nextUrl.pathname.startsWith("/ja")) {
    return NextResponse.redirect(
      new URL(`/ja${request.nextUrl.pathname}`, request.url),
    );
  }

  // 注入請求頭，傳遞給 Server Components
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
      <h1>產品列表</h1>
      <ProductFilters />

      {/* 慢查詢用 Suspense 包裹，流式返回 */}
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>

      {/* 推薦數據也是異步的 */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  );
}

// 產品列表：在 Edge 上執行數據庫查詢
async function ProductList() {
  // 這個函數在 Edge Runtime 上執行
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

// 推薦數據：調用遠程 API
async function Recommendations() {
  const recommendations = await fetch(
    "https://api.example.com/recommendations",
    {
      next: { revalidate: 3600 }, // 1 小時緩存
    },
  ).then((r) => r.json());

  return (
    <section>
      <h2>為你推薦</h2>
      <RecommendationList items={recommendations} />
    </section>
  );
}
```

## Edge 數據緩存策略

```ts
// lib/edge-cache.ts
// Edge 上的多級緩存

interface CacheConfig {
  staleWhileRevalidate: number; // 後臺刷新時間
  maxAge: number; // 緩存有效期
  tags: string[]; // 緩存標籤（用於按標籤失效）
}

// 方案 1：Next.js fetch 緩存
const products = await fetch("https://api.example.com/products", {
  next: {
    revalidate: 60, // 60 秒後重新驗證
    tags: ["products"], // 可通過 revalidateTag("products") 失效
  },
});

// 方案 2：KV 緩存（Cloudflare Workers KV / Vercel KV）
import { kv } from "@vercel/kv";

async function getCachedProducts() {
  const cacheKey = "products:all";

  // 先查緩存
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  // 緩存未命中，查數據庫
  const products = await db.product.findMany();
  await kv.set(cacheKey, products, { ex: 60 });

  return products;
}

// 方案 3：Edge Config（隻讀設定，毫秒級讀取）
import { get } from "@vercel/edge-config";

async function getFeatureFlags() {
  // Edge Config 的讀取延遲 < 1ms
  const flags = await get("feature-flags");
  return flags;
}
```

## Edge 的限製和坑

```
Edge Runtime 限製：
  1. 不支援 Node.js API（fs、crypto 需要 Web Crypto 替代）
  2. 內存限製（通常 128MB）
  3. 執行時間限製（通常 30 秒）
  4. 不支持某些 npm 包（依賴 Node.js 內置模塊的）

踩坑記錄：
  1. Prisma 在 Edge 上需要特殊設定（driver adapters）
  2. 某些日期庫（如 moment）不兼容，改用 date-fns 或 Intl
  3. 圖片處理需要調用外部服務，不能用 sharp
  4. 調試困難，日誌不完整
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
我們的渲染策略：

  /（首頁）           → Edge SSR + Streaming
  /products（列表）    → Edge SSR + 緩存
  /products/[id]（詳情）→ Edge SSR + ISR（1 小時）
  /dashboard（後臺）   → Client-side（純 SPA）
  /blog（博客）        → SSG（構建時生成）
  /api/*（接口）       → Edge Functions

根據頁面特性選擇渲染模式，不是所有頁面都需要 Edge SSR。
```

## 小結

- Edge 渲染適合需要低延遲首屏的公開頁面
- Streaming SSR 是 Edge 渲染的核心模式，讓快的部分先到
- 緩存策略是 Edge 渲染的關鍵，多級緩存降低源站壓力
- Edge Runtime 有 Node.js API 限製，選庫時要注意相容性
- 混合渲染模式是生產環境的最優解，按頁面特性選擇
