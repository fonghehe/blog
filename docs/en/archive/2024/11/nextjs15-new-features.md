---
title: "Next.js 15: Caching Off by Default, PPR, and Turbopack Stable"
date: 2024-11-25 10:00:00
tags:
  - React
readingTime: 2
description: "Next.js 15 officially launched at the end of October. The biggest change is the adjustment to caching strategy — from \"cache by default\" to \"no cache by default"
wordCount: 366
---

Next.js 15 officially launched at the end of October. The biggest change is the adjustment to caching strategy — from "cache by default" to "no cache by default". This change has far-reaching implications.

## Cache Strategy Reversal

Next.js 14 的 `fetch`、`Route Handlers`、`GET` 函数默认缓存结果，需要手动 `revalidate` 或 `noStore()` 来禁用。Next.js 15 反了过来：

```typescript
// Next.js 14：默认缓存
async function getData() {
  const res = await fetch("https://api.example.com/data");
  // 默认缓存！需要显式 revalidate
  return res.json();
}

// Next.js 15：默认不缓存
async function getData() {
  const res = await fetch("https://api.example.com/data");
  // 默认每次请求都获取新数据
  return res.json();
}

// 需要缓存时显式声明
async function getCachedData() {
  const res = await fetch("https://api.example.com/data", {
    next: { revalidate: 60 }, // 60 秒缓存
  });
  return res.json();
}
```

### 为什么这个改变重要

Next.js 14's default caching confused many new users: data not updating, difficult to debug, poor development experience. After the reversal, behavior is more intuitive.

When migrating our project, we only need to add `revalidate` config where caching is truly needed; everything else automatically becomes uncached.

## Partial Prerendering (PPR) Experimentally Stable

PPR 允许同一个路由中混合静态和动态内容：

```tsx
// app/product/[id]/page.tsx
import { Suspense } from "react";

// 静态部分：构建时生成，CDN 缓存
function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-page">
      <header>我的商城</header>       {/* 静态 */}
      <nav>分类导航</nav>             {/* 静态 */}
      {children}                      {/* 动态岛屿 */}
    </div>
  );
}

// 动态部分：每次请求实时渲染
async function ProductPrice({ id }: { id: string }) {
  const price = await getLivePrice(id);
  return <span className="price">{price}</span>;
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <ProductLayout>
      <ProductInfo id={params.id} />          {/* 静态 */}
      <Suspense fallback={<PriceSkeleton />}>
        <ProductPrice id={params.id} />       {/* 动态 */}
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews id={params.id} />     {/* 动态 */}
      </Suspense>
    </ProductLayout>
  );
}
```

The core value of PPR: static shell + dynamic holes. CDN returns the static HTML shell, and the dynamic parts are streamed in.

## Turbopack Production Stable

Turbopack（Rust 编写的打包器）在 Next.js 15 中正式稳定：

```bash
# 开发模式
next dev --turbopack

# 构建时间对比（我们的项目，~800 页面）
# Webpack: ~120s
# Turbopack: ~35s
```

## after() API

服务器操作完成后执行非阻塞任务：

```typescript
// app/actions.ts
"use server";

import { after } from "next/server";

export async function submitOrder(formData: FormData) {
  // 关键路径：保存订单
  const order = await db.order.create({ data: { ... } });

  after(async () => {
    // 非关键路径：发送通知、更新统计数据等
    await sendOrderConfirmationEmail(order.id);
    await analytics.track("order_placed", { orderId: order.id });
    await cache.revalidate("order-stats");
  });

  return { orderId: order.id };
}
```

Functions inside `after()` do not block the response from returning; users see results faster.

## Form Component Enhancements

```tsx
// 直接用 <form> 调用 Server Action，不需要 JS
<form action={createTodo}>
  <input name="title" />
  <button type="submit">添加</button>
</form>

// 带 pending 状态
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "提交中..." : "提交"}</button>;
}
```

## Migration Checklist

```bash
npx @next/codemod@canary upgrade
```

需要手动检查的点：

1. 依赖 `fetch` 默认缓存的代码，需要显式加 `revalidate`
2. `unstable_cache` API 改为 `import { cache } from "react"`
3. `cookies()` 和 `headers()` 现在是异步的
4. `next/image` 的默认配置有调整

## Summary

- 缓存默认关闭：行为更直觉，需要缓存时显式声明
- PPR：静态壳 + 动态岛屿，兼顾性能和实时性
- Turbopack 正式稳定：开发构建速度提升 3-4 倍
- `after()` API：非阻塞副作用处理
- 迁移用官方 codemod 工具，降低手动修改成本
