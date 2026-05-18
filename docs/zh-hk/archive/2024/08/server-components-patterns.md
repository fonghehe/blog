---
title: "React Server Components 設計模式：實戰總結"
date: 2024-08-05 10:00:00
tags:
  - JavaScript
  - React
readingTime: 2
description: "Server Components 進入穩定期，我們團隊在一箇中等複雜度的項目中落地了 RSC 架構。總結一下實際項目中驗證過的模式和踩坑經驗。"
---

Server Components 進入穩定期，我們團隊在一箇中等複雜度的項目中落地了 RSC 架構。總結一下實際項目中驗證過的模式和踩坑經驗。

## 模式一：數據獲取下沉

最直接的好處：數據獲取邏輯從客户端移到服務端。

```tsx
// app/products/[id]/page.tsx — Server Component
import { db } from "@/lib/db";
import { Suspense } from "react";

// 這個函數只在服務端運行，零客户端 JS
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

// 獨立的流式加載區塊
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

## 模式二：交互島嶼隔離

保持交互邏輯的最小化客户端邊界：

```tsx
// Server Component 中嵌入 Client Component
// app/dashboard/page.tsx
import { StatsChart } from "@/components/stats-chart"; // Server
import { DateRangePicker } from "@/components/date-picker"; // 'use client'

export default async function Dashboard() {
  const stats = await getDashboardStats();

  return (
    <div>
      <h1>數據看板</h1>
      {/* 交互組件標記 'use client'，邊界清晰 */}
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

## 模式三：Parallel Routes 並行路由

複雜頁面的多區域獨立加載：

```
app/
├── layout.tsx
├── @analytics/
│   └── page.tsx        ← Server Component
├── @orders/
│   └── page.tsx        ← Server Component
├── @notifications/
│   └── page.tsx        ← Server Component
└── page.tsx            ← 主頁面 layout
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

每個 slot 獨立獲取數據、獨立 Suspense、獨立流式傳輸。

## 模式四：Server Actions 處理表單

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

## 踩坑經驗

**不要在 Server Component 中用 React hooks**。`useState`、`useEffect` 等只在 Client Component 中可用。

**序列化邊界要注意**。Server Component 向 Client Component 傳遞 props 時，只能傳遞可序列化的數據。Date 對象、Map、Set 都不能直接傳。

**"use client" 不是整個組件樹**。標記了 `"use client"` 的組件仍然可以在服務端渲染，只是它的子組件會在客户端 hydrate。

## 小結

- 數據獲取下沉到 Server Component，減少客户端 JS bundle
- Suspense 流式加載讓頁面感知更快
- Parallel Routes 實現多區域獨立加載
- Server Actions 簡化表單提交和數據變更
- 關鍵是控制好 Server/Client 邊界，最小化客户端代碼
