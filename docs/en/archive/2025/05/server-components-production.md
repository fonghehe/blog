---
title: "Server Components in Production: Lessons from One Year"
date: 2025-05-18 10:00:00
tags:
  - Frontend
readingTime: 2
description: "Our team has been using Server Components on Next.js 15 for a full year. We've hit plenty of pitfalls and learned a lot. Here's a summary of our hard-won experi"
---

Our team has been using Server Components on Next.js 15 for a full year. We've hit plenty of pitfalls and learned a lot. Here's a summary of our hard-won experience.

## The Mental Model for Server Components

```
Component Type    Execution Env      Capabilities                Limitations
────────────────────────────────────────────────────────────────────────────
Server Component  Server             Database, file system,      Cannot use useState/useEffect
                  (Node/Edge)        API calls, sensitive ops     Cannot use browser APIs

Client Component  Browser            Interaction, state,         Cannot access DB directly
                  ("use client")     lifecycle, browser APIs      Increases JS bundle size
```

## Lesson 1: Data Fetching Patterns

```tsx
// app/dashboard/page.tsx — Server Component 直接查数据库
import { db } from "@/lib/db";
import { Suspense } from "react";

export default async function DashboardPage() {
  // 并行获取不依赖的数据
  const [stats, recentActivity] = await Promise.all([
    getStats(),
    getRecentActivity(),
  ]);

  return (
    <div className="grid gap-6">
      {/* 快速数据先渲染 */}
      <StatsOverview stats={stats} />

      {/* 慢数据用 Suspense 流式加载 */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity data={recentActivity} />
      </Suspense>

      {/* 第三方 API 单独处理 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  );
}

// 独立的数据获取函数
async function getStats() {
  const [userCount, orderCount, revenue] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { amount: true } }),
  ]);

  return { userCount, orderCount, revenue: revenue._sum.amount ?? 0 };
}
```

## Lesson 2: State Management Boundaries

```tsx
// 错误：在 Server Component 中使用状态
// 这会报错！
export default function Page() {
  const [count, setCount] = useState(0); // ❌ Server Component 不能用
  return <div>{count}</div>;
}

// 正确：把状态管理下沉到 Client Component
// app/page.tsx — Server Component
import { Counter } from "./Counter";

export default async function Page() {
  const initialValue = await db.counter.findFirst();
  return <Counter initialValue={initialValue?.value ?? 0} />;
}

// components/Counter.tsx — Client Component
("use client");
import { useState } from "react";

export function Counter({ initialValue }: { initialValue: number }) {
  const [count, setCount] = useState(initialValue);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## Lesson 3: Serialization Issues

```tsx
// 问题：Server Component 传递的数据必须可序列化
// 不能传递函数、Date 对象、Map、Set 等

// ❌ 错误
export default async function Page() {
  const product = await db.product.findFirst();
  return <ProductCard product={product} />; // product 包含 Date 对象
}

// ProductCard.tsx（Client Component）
("use client");
// Date 对象经过序列化后变成字符串！
// console.log(product.createdAt) → "2025-01-15T10:00:00.000Z"（字符串）

// ✅ 正确：显式转换
export default async function Page() {
  const product = await db.product.findFirst();
  return (
    <ProductCard
      product={{
        ...product,
        createdAt: product.createdAt.toISOString(), // 显式序列化
      }}
    />
  );
}

// 或者在 Client Component 中处理
("use client");
export function ProductCard({ product }: { product: SerializedProduct }) {
  const createdAt = new Date(product.createdAt); // 反序列化
  return <time>{createdAt.toLocaleDateString()}</time>;
}
```

## Lesson 4: Error Handling

```tsx
// app/products/error.tsx — 错误边界
"use client";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-lg font-semibold">加载失败</h2>
      <p className="text-muted-foreground mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4">
        重试
      </button>
    </div>
  );
}

// Server Component 中的错误处理
export default async function ProductsPage() {
  try {
    const products = await db.product.findMany();
    return <ProductList products={products} />;
  } catch (error) {
    // Next.js 会捕获这个错误，显示 error.tsx
    throw new Error("获取产品列表失败");
  }
}
```

## Lesson 5: Performance Optimization

```tsx
// 用 React.cache() 做请求级去重
import { cache } from "react";

// 相同请求在一个 SSR 周期内只执行一次
const getUser = cache(async (id: string) => {
  console.log("查询用户:", id); // 只会打印一次
  return db.user.findUnique({ where: { id } });
});

// 在多个 Server Component 中调用
// Header.tsx
export async function Header() {
  const user = await getUser("current"); // 查询
  return <nav>欢迎, {user.name}</nav>;
}

// Sidebar.tsx
export async function Sidebar() {
  const user = await getUser("current"); // 命中缓存，不查询
  return <aside>角色: {user.role}</aside>;
}
```

## Pitfalls Summary

```
1. Push "use client" boundaries as deep as possible
   Place "use client" on the smallest interactive component, not at page level
```

## Summary

- Server Components fundamentally change the frontend data fetching model
- Keep state management boundaries clear: Server Components for data, Client Components for interaction
- Serialization must be explicit: Date objects, Maps, Sets, and functions cannot be passed directly
- Use `React.cache()` to deduplicate requests within the same SSR cycle
- Error boundaries (`error.tsx`) are essential infrastructure
