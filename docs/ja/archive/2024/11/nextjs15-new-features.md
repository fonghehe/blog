---
title: "Next.js 15：デフォルトキャッシュオフ、PPR、Turbopack安定化"
date: 2024-11-25 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 15 が10月末に正式リリースされました。最大の変更はキャッシュ戦略の調整——「デフォルトキャッシュ」から「デフォルトキャッシュなし」への転換です。この変更は大きな影響を与えます。"
---

Next.js 15 が10月末に正式リリースされました。最大の変更はキャッシュ戦略の調整——「デフォルトキャッシュ」から「デフォルトキャッシュなし」への転換です。この変更は大きな影響を与えます。

## キャッシュ戦略の逆転

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

Next.js 14 的默认缓存导致很多新用户困惑：数据不更新、调试困难、开发体验差。反转后行为更符合直觉。

プロジェクトの移行時、本当にキャッシュが必要な場所にのみ `revalidate` 設定を追加するだけで、他は自動的にキャッシュなしになります。

## Partial Prerendering (PPR) 実験的安定化

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

PPR のコアバリュー：静的シェル + 動的穴。CDN が静的 HTML シェルを返し、動的な部分がストリーミングで埋められます。

## Turbopack 本番安定化

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

`after()` 内の関数はレスポンスの返却をブロックせず、ユーザーはより早く結果を確認できます。

## フォームコンポーネント強化

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

## 移行チェックリスト

```bash
npx @next/codemod@canary upgrade
```

需要手动检查的点：

1. 依赖 `fetch` 默认缓存的代码，需要显式加 `revalidate`
2. `unstable_cache` API 改为 `import { cache } from "react"`
3. `cookies()` 和 `headers()` 现在是异步的
4. `next/image` 的默认配置有调整

## まとめ

- 缓存默认关闭：行为更直觉，需要缓存时显式声明
- PPR：静态壳 + 动态岛屿，兼顾性能和实时性
- Turbopack 正式稳定：开发构建速度提升 3-4 倍
- `after()` API：非阻塞副作用处理
- 迁移用官方 codemod 工具，降低手动修改成本
