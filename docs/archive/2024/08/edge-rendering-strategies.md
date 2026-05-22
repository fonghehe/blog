---
title: "Edge 渲染策略选型：CDN Worker、ISR 还是 Streaming SSR"
date: 2024-08-20 16:14:51
tags:
  - 工程化
readingTime: 2
description: "Edge Computing 在前端领域越来越热。作为架构负责人，最近做了几个项目的渲染策略选型。整理一下不同场景下的决策逻辑。"
wordCount: 283
---

Edge Computing 在前端领域越来越热。作为架构负责人，最近做了几个项目的渲染策略选型。整理一下不同场景下的决策逻辑。

## 渲染策略全景

```
静态生成（SSG）      → 构建时生成，CDN 缓存，最快
增量静态再生（ISR）  → 按需生成 + 定期重新验证
流式 SSR             → 服务端渲染 + 流式传输
Edge SSR             → 在 CDN 边缘节点渲染
Edge Middleware       → 边缘节点做路由/鉴权/改写
```

## 场景一：营销页面 → SSG + ISR

内容变化不频繁的页面，SSG 是最优解：

```typescript
// next.config.js
module.exports = {
  output: "export", // 纯静态
};
```

需要内容更新但不需要实时性的，用 ISR：

```typescript
// app/marketing/[slug]/page.tsx
export async function generateStaticParams() {
  const pages = await getCmsPages();
  return pages.map((p) => ({ slug: p.slug }));
}

// 60秒后重新验证，用户看到的最多延迟 60 秒
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

## 场景二：用户仪表盘 → Edge SSR

个性化内容多、对首屏延迟敏感的场景：

```typescript
// middleware.ts — Edge Runtime
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 在边缘节点做鉴权，不需要回源
  const token = request.cookies.get("auth-token");

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 根据用户地区选择语言
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

## 场景三：电商商品页 → Streaming SSR + Edge

商品信息实时性要求高，但不同区块优先级不同：

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
      {/* 核心信息同步加载 */}
      <ProductHeader id={params.id} />

      {/* 评论延迟加载 */}
      <Suspense fallback={<div>加载评论中...</div>}>
        <ProductReviews id={params.id} />
      </Suspense>

      {/* 推荐商品延迟加载 */}
      <Suspense fallback={<div>加载推荐中...</div>}>
        <Recommendations id={params.id} />
      </Suspense>
    </div>
  );
}
```

## 场景四：A/B 测试 → Edge Middleware

在边缘节点分流，不影响后端逻辑：

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

  // 根据 bucket 改写到不同版本的页面
  if (bucket === "variant-a" && request.nextUrl.pathname === "/checkout") {
    return NextResponse.rewrite(new URL("/checkout-v2", request.url));
  }

  return response;
}
```

## 选型决策树

```
内容是否所有人一样？
├── 是 → SSG
└── 否 → 内容变化频率？
    ├── 低（分钟级）→ ISR
    ├── 中（秒级）→ Streaming SSR
    └── 高（实时）→ Edge SSR + WebSocket
```

```
是否需要边缘处理（鉴权/分流/地理）？
├── 是 → Edge Middleware + 上述渲染策略
└── 否 → 普通 SSR 即可
```

## 成本考量

```
SSG：     构建成本高，运行成本极低（纯 CDN）
ISR：     构建成本低，运行成本低（按需生成）
Edge SSR：运行成本中等（Edge Worker 计费）
Streaming SSR：运行成本中等（需要 Node.js 服务器）
```

我们内部项目的经验：90% 的页面用 SSG/ISR，10% 的页面用 Edge SSR。不要为了用 Edge 而用 Edge。

## 小结

- 内容不怎么变 → SSG/ISR，成本最低
- 个性化 + 低延迟 → Edge SSR
- 分区块优先级 → Streaming SSR + Suspense
- 鉴权/分流/改写 → Edge Middleware
- 不要过度工程化，按需选择
