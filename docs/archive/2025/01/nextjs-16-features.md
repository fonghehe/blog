---
title: "Next.js 16 新特性预览"
date: 2025-01-09 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 16 在 Vercel Ship 2025 上正式发布，核心主题是「编译即架构」——把更多运行时逻辑推到编译期，减少服务端和客户端之间的边界开销。对 React 20 Compiler 的原生支持、Server Actions 的事务化、以及全新的路由中间件是最大的三个变化。"
wordCount: 483
---

Next.js 16 在 Vercel Ship 2025 上正式发布，核心主题是「编译即架构」——把更多运行时逻辑推到编译期，减少服务端和客户端之间的边界开销。对 React 20 Compiler 的原生支持、Server Actions 的事务化、以及全新的路由中间件是最大的三个变化。

## React 20 Compiler 零配置支持

Next.js 16 内置了 React 20 Compiler，不再需要手动安装 Babel 插件。Turbo 模式下编译速度比 15 快了 40%。

```javascript
// next.config.ts - 最小化配置
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactCompiler: {
    enabled: true,
    // 可选：只对特定路径开启
    include: ['app/(main)/**/*.{ts,tsx}'],
    exclude: ['**/*.test.tsx'],
  },
  experimental: {
    // 编译器生成的优化代码会利用这些运行时特性
    ppr: true, // Partial Prerendering 正式稳定
  },
};

export default config;
```

PPR（Partial Prerendering）在 16 中正式稳定。它把页面拆分为静态 shell 和动态 slots，静态部分在边缘节点预渲染，动态部分流式传输。

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react';

// 静态部分：build 时生成
async function ProductInfo({ id }: { id: string }) {
  const product = await db.product.findUnique({ where: { id } });
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <PriceDisplay price={product.price} />
    </div>
  );
}

// 动态部分：请求时流式渲染
async function StockStatus({ id }: { id: string }) {
  const stock = await api.getLiveStock(id);
  return <span>{stock.available ? '有货' : '缺货'}</span>;
}

export default function ProductPage({ params }: { params: { id: string } }) {
  return (
    <main>
      <ProductInfo id={params.id} />
      <Suspense fallback={<Skeleton />}>
        <StockStatus id={params.id} />
      </Suspense>
    </main>
  );
}
```

## 路由中间件（Route Middleware）

这是 Next.js 16 最实用的新特性。之前中间件只能在根目录的 `middleware.ts` 中写，现在你可以在任意路由层级定义中间件，形成中间件链。

```typescript
// app/api/auth/middleware.ts
import { NextResponse } from 'next/server';
import type { MiddlewareFn } from 'next';

export const middleware: MiddlewareFn = async (request) => {
  const token = request.cookies.get('session')?.value;
  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 将用户信息注入 headers，供下游 handler 使用
  const headers = new Headers(request.headers);
  headers.set('x-user-id', session.userId);
  headers.set('x-user-role', session.role);

  return NextResponse.next({ request: { headers } });
};

// app/api/admin/middleware.ts - 嵌套中间件
export const middleware: MiddlewareFn = async (request) => {
  const role = request.headers.get('x-user-role');
  if (role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  return NextResponse.next();
};
```

路由中间件的执行顺序是从外到内（`app/api/auth/middleware.ts` -> `app/api/admin/middleware.ts`），和 Express 的路由层级完全一致。

## Server Actions 事务化

Next.js 16 的 Server Actions 支持事务化执行，多个 action 可以在一个数据库事务中完成：

```typescript
'use server';

import { db } from '@/lib/db';

export async function transferFunds(formData: FormData) {
  'use transaction'; // 新指令：标记为事务性 action

  const fromId = formData.get('fromAccount') as string;
  const toId = formData.get('toAccount') as string;
  const amount = Number(formData.get('amount'));

  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } },
    });
    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });
    await tx.transferLog.create({
      data: { fromId, toId, amount },
    });
  });
}
```

如果事务中的任何操作失败，整个操作会回滚，客户端会收到结构化的错误信息，React 会自动回滚乐观更新。

## 编译产物分析

Next.js 16 引入了 `next analyze --compiler` 命令，可以可视化编译器的优化决策：

```bash
# 查看哪些组件被 Compiler 优化了
next analyze --compiler --report

# 输出示例：
# ✓ app/page.tsx:Home - 12 个 memoization 自动插入
# ✓ app/products/page.tsx:ProductList - 8 个 memoization 自动插入
# ⚠ app/dashboard/page.tsx:Chart - 跳过（包含 Math.random()）
# ✗ app/legacy/AdminPanel - 跳过（目录被 exclude）
```

## 小结

- React 20 Compiler 零配置集成，PPR 正式稳定，静态/动态内容自动分层
- 路由中间件支持嵌套层级，解决了鉴权、日志等横切关注点的组织问题
- Server Actions 事务化让复杂业务操作变得安全可靠
- 编译产物分析工具让优化决策透明化
- Next.js 16 的核心思路是「编译期做更多，运行时做更少」，这个方向是对的
