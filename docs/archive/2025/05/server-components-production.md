---
title: "Server Components 一年：生产环境的教训"
date: 2025-05-18 19:52:29
tags:
  - 前端
readingTime: 2
description: "团队在 Next.js 15 上全面使用 Server Components 已经一年了。踩了不少坑，也学到了很多。来总结一下实战经验。"
wordCount: 206
---

团队在 Next.js 15 上全面使用 Server Components 已经一年了。踩了不少坑，也学到了很多。来总结一下实战经验。

## Server Components 的心智模型

```
组件类型          执行环境        能力                    限制
───────────────────────────────────────────────────────────
Server Component  服务端         数据库、文件系统、       不能用 useState/useEffect
                  (Node/Edge)   API 调用、敏感操作       不能用浏览器 API

Client Component  浏览器         交互、状态、生命周期     不能直接访问数据库
                  ("use client") 浏览器 API              增加 JS 包大小
```

## 实战经验 1：数据获取模式

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

## 实战经验 2：状态管理边界

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
"use client";
import { useState } from "react";

export function Counter({ initialValue }: { initialValue: number }) {
  const [count, setCount] = useState(initialValue);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## 实战经验 3：序列化问题

```tsx
// 问题：Server Component 传递的数据必须可序列化
// 不能传递函数、Date 对象、Map、Set 等

// ❌ 错误
export default async function Page() {
  const product = await db.product.findFirst();
  return <ProductCard product={product} />; // product 包含 Date 对象
}

// ProductCard.tsx（Client Component）
"use client";
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
"use client";
export function ProductCard({ product }: { product: SerializedProduct }) {
  const createdAt = new Date(product.createdAt); // 反序列化
  return <time>{createdAt.toLocaleDateString()}</time>;
}
```

## 实战经验 4：错误处理

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

## 实战经验 5：性能优化

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

## 踩坑总结

```
1. "use client" 边界要尽量下沉
   把 "use client" 放在最小的交互组件上，不要放在页面级

2. 注意 hydration 不匹配
   Server 和 Client 渲染结果必须一致
   常见问题：Date.now()、Math.random()、Intl 格式化

3. 不要在 Server Component 中用 Context
   Server Component 没有 React 树的概念

4. 表单用 Server Actions
   不需要手动创建 API 路由

5. 图片用 next/image
   自动优化，自动生成 srcset
```

## 小结

- Server Components 的核心价值：减少客户端 JS、直接访问后端资源
- 数据获取模式要从 "useEffect + fetch" 转变为 "async/await 直接查"
- 序列化问题是最常见的坑，要特别注意 Date、Map 等类型
- "use client" 边界越下沉越好，保持大部分组件是 Server Component
- 一年下来，Server Components 在生产环境中是成熟的，值得全面采用
