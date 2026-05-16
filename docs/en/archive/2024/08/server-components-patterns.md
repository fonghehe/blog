---
title: "React Server Components Design Patterns: Practical Summary"
date: 2024-08-05 10:00:00
tags:
  - JavaScript
  - React
readingTime: 2
description: "Server Components 进入稳定期，我们团队在一个中等复杂度的项目中落地了 RSC 架构。总结一下实际项目中验证过的模式和踩坑经验。"
---

Server Components 进入稳定期，我们团队在一个中等复杂度的项目中落地了 RSC 架构。总结一下实际项目中验证过的模式和踩坑经验。

## Pattern 1: Data Fetching Push-Down

最直接的好处：数据获取逻辑从客户端移到服务端。

```tsx
// app/products/[id]/page.tsx — Server Component
import { db } from "@/lib/db";
import { Suspense } from "react";

// 这个函数只在服务端运行，零客户端 JS
async function ProductDetail({ id }: { id: string }) {
  const product = await db.product.findUnique({
    where: { id },
    include: { reviews: true, relatedProducts: true },
  });

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews productId={id} />
      </Suspense>
    </div>
  );
}

// 独立的流式加载区块
async function ProductReviews({ productId }: { productId: string }) {
  const reviews = await db.review.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ul>
      {reviews.map((r) => (
        <li key={r.id}>{r.content} — {r.rating}/5</li>
      ))}
    </ul>
  );
}
```

## Pattern 2: Interactive Island Isolation

保持交互逻辑的最小化客户端边界：

```tsx
// Server Component 中嵌入 Client Component
// app/dashboard/page.tsx
import { StatsChart } from "@/components/stats-chart"; // Server
import { DateRangePicker } from "@/components/date-picker"; // 'use client'

export default async function Dashboard() {
  const stats = await getDashboardStats();

  return (
    <div>
      <h1>数据看板</h1>
      {/* 交互组件标记 'use client'，边界清晰 */}
      <DateRangePicker onRangeChange={fetchStatsByRange} />
      <StatsChart data={stats} />
    </div>
  );
}
```

```tsx
// components/date-picker.tsx
"use client";

import { useState } from "react";
import { DatePicker } from "@mantine/dates";

export function DateRangePicker({
  onRangeChange,
}: {
  onRangeChange: (range: [Date, Date]) => void;
}) {
  const [range, setRange] = useState<[Date, Date]>([
    new Date(),
    new Date(),
  ]);

  return (
    <DatePicker
      type="range"
      value={range}
      onChange={(val) => {
        setRange(val as [Date, Date]);
        onRangeChange(val as [Date, Date]);
      }}
    />
  );
}
```

## Pattern 3: Parallel Routes

复杂页面的多区域独立加载：

```
app/
├── layout.tsx
├── @analytics/
│   └── page.tsx        ← Server Component
├── @orders/
│   └── page.tsx        ← Server Component
├── @notifications/
│   └── page.tsx        ← Server Component
└── page.tsx            ← 主页面 layout
```

```tsx
// app/page.tsx
export default function DashboardLayout({
  analytics,
  orders,
  notifications,
}: {
  analytics: React.ReactNode;
  orders: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <div className="dashboard-grid">
      <section>{analytics}</section>
      <section>{orders}</section>
      <aside>{notifications}</aside>
    </div>
  );
}
```

每个 slot 独立获取数据、独立 Suspense、独立流式传输。

## Pattern 4: Server Actions for Forms

```tsx
// app/settings/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function updateProfile(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;

  await db.user.update({
    where: { id: getCurrentUserId() },
    data: { name, email },
  });

  revalidatePath("/settings");
}
```

```tsx
// app/settings/page.tsx
import { updateProfile } from "./actions";

export default function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <form action={updateProfile}>
      <input name="name" defaultValue={user.name} />
      <input name="email" defaultValue={user.email} />
      <button type="submit">保存</button>
    </form>
  );
}
```

## Lessons Learned

**不要在 Server Component 中用 React hooks**。`useState`、`useEffect` 等只在 Client Component 中可用。

**序列化边界要注意**。Server Component 向 Client Component 传递 props 时，只能传递可序列化的数据。Date 对象、Map、Set 都不能直接传。

**"use client" 不是整个组件树**。标记了 `"use client"` 的组件仍然可以在服务端渲染，只是它的子组件会在客户端 hydrate。

## Summary

- 数据获取下沉到 Server Component，减少客户端 JS bundle
- Suspense 流式加载让页面感知更快
- Parallel Routes 实现多区域独立加载
- Server Actions 简化表单提交和数据变更
- 关键是控制好 Server/Client 边界，最小化客户端代码
