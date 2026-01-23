---
title: "React 2026 未来方向"
date: 2026-01-23 10:00:00
tags:
  - React
---

React 20 发布后，框架层面的变化趋于稳定，但生态和底层架构仍在快速演进。React Compiler 已经成熟、Server Components 成为默认、新的并发原语正在重新定义前端的数据获取模式。本文梳理 React 在 2026 年的核心变化和实际影响。

## React Compiler：不再需要手动 memo

React Compiler 终于正式稳定了。useMemo、useCallback、React.memo 这些手动优化全部变成编译器自动处理。这不是小变化——它彻底改变了 React 的性能优化心智模型。

```tsx
// 2024 年的写法：手动 memo 到处都是
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

// 2026 年的写法：编译器自动处理
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
        // 编译器会自动分析并优化，但你可以配置例外
        dedupe: true,
        // 对特定文件禁用编译器优化
        ignorePatterns: ['**/*.test.tsx', '**/legacy/**'],
        // 性能分析模式：输出编译器做了哪些优化
        report: 'verbose',
      },
    }),
  ],
});
```

## Server Components 的深度实践

RSC 已经不是新鲜事了，但很多团队还停留在"页面是 Server Component，交互部分是 Client Component"的简单用法。真正发挥 RSC 价值的是流式渲染、并行数据获取、以及 server action 的深度使用。

```tsx
// app/dashboard/page.tsx —— 流式渲染 + 并行获取
import { Suspense } from 'react';

// 每个组件独立获取自己的数据，互不阻塞
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 并行加载，哪个先返回哪个先显示 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <UserGrowthChart />
      </Suspense>

      {/* 这个组件可能比较慢，但它不阻塞上面的图表 */}
      <div className="col-span-2">
        <Suspense fallback={<TableSkeleton rows={10} />}>
          <RecentTransactions />
        </Suspense>
      </div>
    </div>
  );
}

// RevenueChart.tsx —— 直接在 Server Component 中查询数据库
async function RevenueChart() {
  // 不需要 API 层，直接访问数据库
  const data = await db.query.revenue.aggregate({
    where: { date: { gte: subDays(new Date(), 30) } },
    groupBy: ['date'],
    orderBy: { date: 'asc' },
  });

  return <ChartView data={data} />;
}

// RecentTransactions.tsx —— 带有 Server Action 的组件
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

React 20 引入的 Activity API 解决了"隐藏但不卸载"的场景。Tab 切换、路由前进后退、模态框背后的页面——这些场景以前要么卸载组件丢失状态，要么用 CSS display:none 但组件仍在后台运行。

```tsx
// 使用 Activity 实现 Tab 面板
import { Activity, useState } from 'react';

function TabPanels() {
  const [activeTab, setActiveTab] = useState<'orders' | 'analytics' | 'settings'>('orders');

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab('orders')}>订单</button>
        <button onClick={() => setActiveTab('analytics')}>分析</button>
        <button onClick={() => setActiveTab('settings')}>设置</button>
      </nav>

      {/* Activity mode="hidden"：保留 DOM 和状态，但暂停副作用 */}
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

// 实际效果：
// 1. 切换 tab 不会丢失表单输入状态
// 2. 隐藏的面板中 useEffect 和 requestAnimationFrame 自动暂停
// 3. 重新显示时自动恢复，不重新挂载
```

## React 的 View Transition 集成

View Transitions API 和 React 的集成让页面过渡动画变得极其简单。不再需要 framer-motion 做路由过渡了。

```tsx
// 使用 View Transitions 做路由过渡
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
          // 自动为列表项和详情页的主图创建共享元素过渡
          style={{ viewTransitionName: `product-${product.id}` }}
        >
          <ProductCard product={product} />
        </Link>
      ))}
    </div>
  );
}

// 详情页的主图使用相同的 viewTransitionName
// 浏览器自动创建从列表缩略图到详情大图的平滑过渡
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

## 小结

- React Compiler 彻底消除了手动 memo 的心智负担，这是近 3 年最大的 DX 提升
- Server Components 的真正价值在并行数据获取和流式渲染，不只是"SSR 的替代品"
- Activity API 解决了 SPA 长期存在的"隐藏组件状态丢失"问题
- View Transitions 集成让路由过渡动画不再需要重型动画库
- React 2026 的核心趋势：减少开发者的心智负担，让编译器和运行时做更多事
