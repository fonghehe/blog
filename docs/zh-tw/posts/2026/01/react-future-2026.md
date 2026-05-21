---
title: "React 2026 未來方向"
date: 2026-01-23 10:00:00
tags:
  - React
readingTime: 3
description: "React 20 釋出後，框架層面的變化趨於穩定，但生態和底層架構仍在快速演進。React Compiler 已經成熟、Server Components 成為預設、新的併發原語正在重新定義前端的資料獲取模式。本文梳理 React 在 2026 年的核心變化和實際影響。"
wordCount: 463
---

React 20 釋出後，框架層面的變化趨於穩定，但生態和底層架構仍在快速演進。React Compiler 已經成熟、Server Components 成為預設、新的併發原語正在重新定義前端的資料獲取模式。本文梳理 React 在 2026 年的核心變化和實際影響。

## React Compiler：不再需要手動 memo

React Compiler 終於正式穩定了。useMemo、useCallback、React.memo 這些手動最佳化全部變成編譯器自動處理。這不是小變化——它徹底改變了 React 的效能最佳化心智模型。

```tsx
// 2024 年的寫法：手動 memo 到處都是
import { memo, useMemo, useCallback } from 'react';

const ProductCard = memo(function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (id: string) => void;
}) {
  const discount = useMemo(
    () => calculateDiscount(product.price, product.originalPrice),
    [product.price, product.originalPrice]
  );

  const handleClick = useCallback(
    () => onSelect(product.id),
    [onSelect, product.id]
  );

  return (
    <div onClick={handleClick}>
      <h3>{product.name}</h3>
      <span>{discount}% off</span>
    </div>
  );
});

// 2026 年的寫法：編譯器自動處理
// 不需要 memo、useMemo、useCallback
function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (id: string) => void;
}) {
  const discount = calculateDiscount(product.price, product.originalPrice);

  return (
    <div onClick={() => onSelect(product.id)}>
      <h3>{product.name}</h3>
      <span>{discount}% off</span>
    </div>
  );
}
```

```ts
// vite.config.ts —— React Compiler 配置
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // React Compiler 2026 配置
      compiler: {
        target: '20',
        // 編譯器會自動分析並最佳化，但你可以配置例外
        dedupe: true,
        // 對特定檔案停用編譯器最佳化
        ignorePatterns: ['**/*.test.tsx', '**/legacy/**'],
        // 效能分析模式：輸出編譯器做了哪些最佳化
        report: 'verbose',
      },
    }),
  ],
});
```

## Server Components 的深度實踐

RSC 已經不是新鮮事了，但很多團隊還停留在"頁面是 Server Component，互動部分是 Client Component"的簡單用法。真正發揮 RSC 價值的是流式渲染、並行資料獲取、以及 server action 的深度使用。

```tsx
// app/dashboard/page.tsx —— 流式渲染 + 並行獲取
import { Suspense } from 'react';

// 每個元件獨立獲取自己的資料，互不阻塞
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 並行載入，哪個先返回哪個先顯示 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <UserGrowthChart />
      </Suspense>

      {/* 這個元件可能比較慢，但它不阻塞上面的圖表 */}
      <div className="col-span-2">
        <Suspense fallback={<TableSkeleton rows={10} />}>
          <RecentTransactions />
        </Suspense>
      </div>
    </div>
  );
}

// RevenueChart.tsx —— 直接在 Server Component 中查詢資料庫
async function RevenueChart() {
  // 不需要 API 層，直接訪問資料庫
  const data = await db.query.revenue.aggregate({
    where: { date: { gte: subDays(new Date(), 30) } },
    groupBy: ['date'],
    orderBy: { date: 'asc' },
  });

  return <ChartView data={data} />;
}

// RecentTransactions.tsx —— 帶有 Server Action 的元件
async function RecentTransactions() {
  const transactions = await db.query.transactions.findMany({
    limit: 50,
    orderBy: { createdAt: 'desc' },
  });

  async function approveTransaction(id: string) {
    'use server';
    await db.update(transactions).set({ status: 'approved' }).where({ id });
    revalidatePath('/dashboard');
  }

  return (
    <TransactionTable
      data={transactions}
      onApprove={approveTransaction}
    />
  );
}
```

## 新的 Activity API

React 20 引入的 Activity API 解決了"隱藏但不解除安裝"的場景。Tab 切換、路由前進後退、模態框背後的頁面——這些場景以前要麼解除安裝元件丟失狀態，要麼用 CSS display:none 但元件仍在後臺執行。

```tsx
// 使用 Activity 實現 Tab 面板
import { Activity, useState } from 'react';

function TabPanels() {
  const [activeTab, setActiveTab] = useState<'orders' | 'analytics' | 'settings'>('orders');

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab('orders')}>訂單</button>
        <button onClick={() => setActiveTab('analytics')}>分析</button>
        <button onClick={() => setActiveTab('settings')}>設定</button>
      </nav>

      {/* Activity mode="hidden"：保留 DOM 和狀態，但暫停副作用 */}
      <Activity mode={activeTab === 'orders' ? 'visible' : 'hidden'}>
        <OrdersPanel />
      </Activity>

      <Activity mode={activeTab === 'analytics' ? 'visible' : 'hidden'}>
        <AnalyticsPanel />
      </Activity>

      <Activity mode={activeTab === 'settings' ? 'visible' : 'hidden'}>
        <SettingsPanel />
      </Activity>
    </div>
  );
}

// 實際效果：
// 1. 切換 tab 不會丟失表單輸入狀態
// 2. 隱藏的面板中 useEffect 和 requestAnimationFrame 自動暫停
// 3. 重新顯示時自動恢復，不重新掛載
```

## React 的 View Transition 整合

View Transitions API 和 React 的整合讓頁面過渡動畫變得極其簡單。不再需要 framer-motion 做路由過渡了。

```tsx
// 使用 View Transitions 做路由過渡
import { useViewTransition } from 'react';

function ProductList() {
  const transition = useViewTransition();

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.id}`}
          viewTransition
          // 自動為列表項和詳情頁的主圖建立共享元素過渡
          style={{ viewTransitionName: `product-${product.id}` }}
        >
          <ProductCard product={product} />
        </Link>
      ))}
    </div>
  );
}

// 詳情頁的主圖使用相同的 viewTransitionName
// 瀏覽器自動建立從列表縮圖到詳情大圖的平滑過渡
function ProductDetail({ product }: { product: Product }) {
  return (
    <div>
      <img
        src={product.image}
        style={{ viewTransitionName: `product-${product.id}` }}
      />
      <h1>{product.name}</h1>
    </div>
  );
}
```

## 小結

- React Compiler 徹底消除了手動 memo 的心智負擔，這是近 3 年最大的 DX 提升
- Server Components 的真正價值在並行資料獲取和流式渲染，不只是"SSR 的替代品"
- Activity API 解決了 SPA 長期存在的"隱藏元件狀態丟失"問題
- View Transitions 整合讓路由過渡動畫不再需要重型動畫庫
- React 2026 的核心趨勢：減少開發者的心智負擔，讓編譯器和執行時做更多事
