---
title: "Server Components 一年：生產環境的教訓"
date: 2025-05-18 19:52:29
tags:
  - 前端
readingTime: 2
description: "團隊在 Next.js 15 上全面使用 Server Components 已經一年了。踩了不少坑，也學到了很多。來總結一下實戰經驗。"
wordCount: 207
---

團隊在 Next.js 15 上全面使用 Server Components 已經一年了。踩了不少坑，也學到了很多。來總結一下實戰經驗。

## Server Components 的心智模型

```
元件型別          執行環境        能力                    限製
───────────────────────────────────────────────────────────
Server Component  服務端         資料庫、檔案系統、       不能用 useState/useEffect
                  (Node/Edge)   API 呼叫、敏感操作       不能用瀏覽器 API

Client Component  瀏覽器         互動、狀態、生命週期     不能直接訪問資料庫
                  ("use client") 瀏覽器 API              增加 JS 包大小
```

## 實戰經驗 1：資料獲取模式

```tsx
// app/dashboard/page.tsx — Server Component 直接查資料庫
import { db } from "@/lib/db";
import { Suspense } from "react";

export default async function DashboardPage() {
  // 並行獲取不依賴的資料
  const [stats, recentActivity] = await Promise.all([
    getStats(),
    getRecentActivity(),
  ]);

  return (
    <div className="grid gap-6">
      {/* 快速資料先渲染 */}
      <StatsOverview stats={stats} />

      {/* 慢資料用 Suspense 流式載入 */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity data={recentActivity} />
      </Suspense>

      {/* 第三方 API 單獨處理 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  );
}

// 獨立的資料獲取函式
async function getStats() {
  const [userCount, orderCount, revenue] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { amount: true } }),
  ]);

  return { userCount, orderCount, revenue: revenue._sum.amount ?? 0 };
}
```

## 實戰經驗 2：狀態管理邊界

```tsx
// 錯誤：在 Server Component 中使用狀態
// 這會報錯！
export default function Page() {
  const [count, setCount] = useState(0); // ❌ Server Component 不能用
  return <div>{count}</div>;
}

// 正確：把狀態管理下沉到 Client Component
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

## 實戰經驗 3：序列化問題

```tsx
// 問題：Server Component 傳遞的資料必須可序列化
// 不能傳遞函式、Date 物件、Map、Set 等

// ❌ 錯誤
export default async function Page() {
  const product = await db.product.findFirst();
  return <ProductCard product={product} />; // product 包含 Date 物件
}

// ProductCard.tsx（Client Component）
"use client";
// Date 物件經過序列化後變成字串！
// console.log(product.createdAt) → "2025-01-15T10:00:00.000Z"（字串）

// ✅ 正確：顯式轉換
export default async function Page() {
  const product = await db.product.findFirst();
  return (
    <ProductCard
      product={{
        ...product,
        createdAt: product.createdAt.toISOString(), // 顯式序列化
      }}
    />
  );
}

// 或者在 Client Component 中處理
"use client";
export function ProductCard({ product }: { product: SerializedProduct }) {
  const createdAt = new Date(product.createdAt); // 反序列化
  return <time>{createdAt.toLocaleDateString()}</time>;
}
```

## 實戰經驗 4：錯誤處理

```tsx
// app/products/error.tsx — 錯誤邊界
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
      <h2 className="text-lg font-semibold">載入失敗</h2>
      <p className="text-muted-foreground mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4">
        重試
      </button>
    </div>
  );
}

// Server Component 中的錯誤處理
export default async function ProductsPage() {
  try {
    const products = await db.product.findMany();
    return <ProductList products={products} />;
  } catch (error) {
    // Next.js 會捕獲這個錯誤，顯示 error.tsx
    throw new Error("獲取產品列表失敗");
  }
}
```

## 實戰經驗 5：效能最佳化

```tsx
// 用 React.cache() 做請求級去重
import { cache } from "react";

// 相同請求在一個 SSR 週期內隻執行一次
const getUser = cache(async (id: string) => {
  console.log("查詢使用者:", id); // 隻會列印一次
  return db.user.findUnique({ where: { id } });
});

// 在多個 Server Component 中呼叫
// Header.tsx
export async function Header() {
  const user = await getUser("current"); // 查詢
  return <nav>歡迎, {user.name}</nav>;
}

// Sidebar.tsx
export async function Sidebar() {
  const user = await getUser("current"); // 命中快取，不查詢
  return <aside>角色: {user.role}</aside>;
}
```

## 踩坑總結

```
1. "use client" 邊界要儘量下沉
   把 "use client" 放在最小的互動元件上，不要放在頁面級

2. 注意 hydration 不匹配
   Server 和 Client 渲染結果必須一致
   常見問題：Date.now()、Math.random()、Intl 格式化

3. 不要在 Server Component 中用 Context
   Server Component 沒有 React 樹的概念

4. 表單用 Server Actions
   不需要手動建立 API 路由

5. 圖片用 next/image
   自動最佳化，自動生成 srcset
```

## 小結

- Server Components 的核心價值：減少客戶端 JS、直接訪問後端資源
- 資料獲取模式要從 "useEffect + fetch" 轉變為 "async/await 直接查"
- 序列化問題是最常見的坑，要特別注意 Date、Map 等型別
- "use client" 邊界越下沉越好，保持大部分元件是 Server Component
- 一年下來，Server Components 在生產環境中是成熟的，值得全面採用
