---
title: "Next.js 15：Caching 預設關閉、PPR 與 Turbopack 穩定"
date: 2024-11-25 10:00:00
tags:
  - React
readingTime: 2
description: "Next.js 15 在 10 月底正式釋出。最大的變化是快取策略的調整——從\"預設快取\"變為\"預設不快取\"。這個改變影響深遠。"
wordCount: 442
---

Next.js 15 在 10 月底正式釋出。最大的變化是快取策略的調整——從"預設快取"變為"預設不快取"。這個改變影響深遠。

## 快取策略反轉

Next.js 14 的 `fetch`、`Route Handlers`、`GET` 函式預設快取結果，需要手動 `revalidate` 或 `noStore()` 來停用。Next.js 15 反了過來：

```typescript
// Next.js 14：預設快取
async function getData() {
  const res = await fetch("https://api.example.com/data");
  // 預設快取！需要顯式 revalidate
  return res.json();
}

// Next.js 15：預設不快取
async function getData() {
  const res = await fetch("https://api.example.com/data");
  // 預設每次請求都獲取新資料
  return res.json();
}

// 需要快取時顯式宣告
async function getCachedData() {
  const res = await fetch("https://api.example.com/data", {
    next: { revalidate: 60 }, // 60 秒快取
  });
  return res.json();
}
```

### 為什麼這個改變重要

Next.js 14 的預設快取導致很多新使用者困惑：資料不更新、除錯困難、開發體驗差。反轉後行為更符合直覺。

我們的專案遷移時，只需要在真正需要快取的地方加 `revalidate` 配置，其他的自動變成不快取。

## Partial Prerendering (PPR) 實驗性穩定

PPR 允許同一個路由中混合靜態和動態內容：

```tsx
// app/product/[id]/page.tsx
import { Suspense } from "react";

// 靜態部分：構建時生成，CDN 快取
function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-page">
      <header>我的商城</header>       {/* 靜態 */}
      <nav>分類導航</nav>             {/* 靜態 */}
      {children}                      {/* 動態島嶼 */}
    </div>
  );
}

// 動態部分：每次請求即時渲染
async function ProductPrice({ id }: { id: string }) {
  const price = await getLivePrice(id);
  return <span className="price">{price}</span>;
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <ProductLayout>
      <ProductInfo id={params.id} />          {/* 靜態 */}
      <Suspense fallback={<PriceSkeleton />}>
        <ProductPrice id={params.id} />       {/* 動態 */}
      </Suspense>
      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews id={params.id} />     {/* 動態 */}
      </Suspense>
    </ProductLayout>
  );
}
```

PPR 的核心價值：靜態殼 + 動態洞。CDN 返回靜態 HTML 殼，動態部分流式填充。

## Turbopack 生產穩定

Turbopack（Rust 編寫的打包器）在 Next.js 15 中正式穩定：

```bash
# 開發模式
next dev --turbopack

# 構建時間對比（我們的專案，~800 頁面）
# Webpack: ~120s
# Turbopack: ~35s
```

## after() API

伺服器操作完成後執行非阻塞任務：

```typescript
// app/actions.ts
"use server";

import { after } from "next/server";

export async function submitOrder(formData: FormData) {
  // 關鍵路徑：儲存訂單
  const order = await db.order.create({ data: { ... } });

  after(async () => {
    // 非關鍵路徑：傳送通知、更新統計資料等
    await sendOrderConfirmationEmail(order.id);
    await analytics.track("order_placed", { orderId: order.id });
    await cache.revalidate("order-stats");
  });

  return { orderId: order.id };
}
```

`after()` 中的函式不會阻塞響應返回，使用者更快看到結果。

## form 元件增強

```tsx
// 直接用 <form> 呼叫 Server Action，不需要 JS
<form action={createTodo}>
  <input name="title" />
  <button type="submit">新增</button>
</form>

// 帶 pending 狀態
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "提交中..." : "提交"}</button>;
}
```

## 遷移清單

```bash
npx @next/codemod@canary upgrade
```

需要手動檢查的點：

1. 依賴 `fetch` 預設快取的程式碼，需要顯式加 `revalidate`
2. `unstable_cache` API 改為 `import { cache } from "react"`
3. `cookies()` 和 `headers()` 現在是非同步的
4. `next/image` 的預設配置有調整

## 小結

- 快取預設關閉：行為更直覺，需要快取時顯式宣告
- PPR：靜態殼 + 動態島嶼，兼顧效能和即時性
- Turbopack 正式穩定：開發構建速度提升 3-4 倍
- `after()` API：非阻塞副作用處理
- 遷移用官方 codemod 工具，降低手動修改成本
