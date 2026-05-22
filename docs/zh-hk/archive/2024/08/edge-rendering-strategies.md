---
title: "Edge 渲染策略選型：CDN Worker、ISR 還是 Streaming SSR"
date: 2024-08-20 16:14:51
tags:
  - 工程化
readingTime: 2
description: "Edge Computing 在前端領域越來越熱。作為架構負責人，最近做了幾個項目的渲染策略選型。整理一下不同場景下的決策邏輯。"
wordCount: 283
---

Edge Computing 在前端領域越來越熱。作為架構負責人，最近做了幾個項目的渲染策略選型。整理一下不同場景下的決策邏輯。

## 渲染策略全景

```
靜態生成（SSG）      → 構建時生成，CDN 緩存，最快
增量靜態再生（ISR）  → 按需生成 + 定期重新驗證
流式 SSR             → 服務端渲染 + 流式傳輸
Edge SSR             → 在 CDN 邊緣節點渲染
Edge Middleware       → 邊緣節點做路由/鑑權/改寫
```

## 場景一：營銷頁面 → SSG + ISR

內容變化不頻繁的頁面，SSG 是最優解：

```typescript
// next.config.js
module.exports = {
  output: "export", // 純靜態
};
```

需要內容更新但不需要實時性的，用 ISR：

```typescript
// app/marketing/[slug]/page.tsx
export async function generateStaticParams() {
  const pages = await getCmsPages();
  return pages.map((p) => ({ slug: p.slug }));
}

// 60秒後重新驗證，用户看到的最多延遲 60 秒
export const revalidate = 60;

export default async function MarketingPage({
  params,
}: {
  params: { slug: string };
}) {
  const page = await getPage(params.slug);
  return <MarketingLayout page={page} />;
}
```

## 場景二：用户儀表盤 → Edge SSR

個性化內容多、對首屏延遲敏感的場景：

```typescript
// middleware.ts — Edge Runtime
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 在邊緣節點做鑑權，不需要回源
  const token = request.cookies.get("auth-token");

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 根據用户地區選擇語言
  const country = request.geo?.country || "CN";
  const response = NextResponse.next();
  response.headers.set("x-user-country", country);

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

```typescript
// 配置 Edge Runtime
export const runtime = "edge";
```

## 場景三：電商商品頁 → Streaming SSR + Edge

商品信息實時性要求高，但不同區塊優先級不同：

```tsx
// app/product/[id]/page.tsx
import { Suspense } from "react";

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div>
      {/* 核心信息同步加載 */}
      <ProductHeader id={params.id} />

      {/* 評論延遲加載 */}
      <Suspense fallback={<div>加載評論中...</div>}>
        <ProductReviews id={params.id} />
      </Suspense>

      {/* 推薦商品延遲加載 */}
      <Suspense fallback={<div>加載推薦中...</div>}>
        <Recommendations id={params.id} />
      </Suspense>
    </div>
  );
}
```

## 場景四：A/B 測試 → Edge Middleware

在邊緣節點分流，不影響後端邏輯：

```typescript
// middleware.ts
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const bucket = Math.random() < 0.5 ? "control" : "variant-a";

  const response = NextResponse.next();
  response.cookies.set("ab-bucket", bucket, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 天
  });

  // 根據 bucket 改寫到不同版本的頁面
  if (bucket === "variant-a" && request.nextUrl.pathname === "/checkout") {
    return NextResponse.rewrite(new URL("/checkout-v2", request.url));
  }

  return response;
}
```

## 選型決策樹

```
內容是否所有人一樣？
├── 是 → SSG
└── 否 → 內容變化頻率？
    ├── 低（分鐘級）→ ISR
    ├── 中（秒級）→ Streaming SSR
    └── 高（實時）→ Edge SSR + WebSocket
```

```
是否需要邊緣處理（鑑權/分流/地理）？
├── 是 → Edge Middleware + 上述渲染策略
└── 否 → 普通 SSR 即可
```

## 成本考量

```
SSG：     構建成本高，運行成本極低（純 CDN）
ISR：     構建成本低，運行成本低（按需生成）
Edge SSR：運行成本中等（Edge Worker 計費）
Streaming SSR：運行成本中等（需要 Node.js 服務器）
```

我們內部項目的經驗：90% 的頁面用 SSG/ISR，10% 的頁面用 Edge SSR。不要為了用 Edge 而用 Edge。

## 小結

- 內容不怎麼變 → SSG/ISR，成本最低
- 個性化 + 低延遲 → Edge SSR
- 分區塊優先級 → Streaming SSR + Suspense
- 鑑權/分流/改寫 → Edge Middleware
- 不要過度工程化，按需選擇
