---
title: "Next.js 16 新特性預覽"
date: 2025-01-09 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 16 在 Vercel Ship 2025 上正式發佈，核心主題是「編譯即架構」——把更多運行時邏輯推到編譯期，減少服務端和客户端之間的邊界開銷。對 React 20 Compiler 的原生支持、Server Actions 的事務化、以及全新的路由中間件是最大的三個變化。"
wordCount: 483
---

Next.js 16 在 Vercel Ship 2025 上正式發佈，核心主題是「編譯即架構」——把更多運行時邏輯推到編譯期，減少服務端和客户端之間的邊界開銷。對 React 20 Compiler 的原生支持、Server Actions 的事務化、以及全新的路由中間件是最大的三個變化。

## React 20 Compiler 零配置支持

Next.js 16 內置了 React 20 Compiler，不再需要手動安裝 Babel 插件。Turbo 模式下編譯速度比 15 快了 40%。

```javascript
// next.config.ts - 最小化配置
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactCompiler: {
    enabled: true,
    // 可選：只對特定路徑開啓
    include: ['app/(main)/**/*.{ts,tsx}'],
    exclude: ['**/*.test.tsx'],
  },
  experimental: {
    // 編譯器生成的優化代碼會利用這些運行時特性
    ppr: true, // Partial Prerendering 正式穩定
  },
};

export default config;
```

PPR（Partial Prerendering）在 16 中正式穩定。它把頁面拆分為靜態 shell 和動態 slots，靜態部分在邊緣節點預渲染，動態部分流式傳輸。

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react';

// 靜態部分：build 時生成
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

// 動態部分：請求時流式渲染
async function StockStatus({ id }: { id: string }) {
  const stock = await api.getLiveStock(id);
  return <span>{stock.available ? '有貨' : '缺貨'}</span>;
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

## 路由中間件（Route Middleware）

這是 Next.js 16 最實用的新特性。之前中間件只能在根目錄的 `middleware.ts` 中寫，現在你可以在任意路由層級定義中間件，形成中間件鏈。

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

  // 將用户信息注入 headers，供下游 handler 使用
  const headers = new Headers(request.headers);
  headers.set('x-user-id', session.userId);
  headers.set('x-user-role', session.role);

  return NextResponse.next({ request: { headers } });
};

// app/api/admin/middleware.ts - 嵌套中間件
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

路由中間件的執行順序是從外到內（`app/api/auth/middleware.ts` -> `app/api/admin/middleware.ts`），和 Express 的路由層級完全一致。

## Server Actions 事務化

Next.js 16 的 Server Actions 支持事務化執行，多個 action 可以在一個數據庫事務中完成：

```typescript
'use server';

import { db } from '@/lib/db';

export async function transferFunds(formData: FormData) {
  'use transaction'; // 新指令：標記為事務性 action

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

如果事務中的任何操作失敗，整個操作會回滾，客户端會收到結構化的錯誤信息，React 會自動回滾樂觀更新。

## 編譯產物分析

Next.js 16 引入了 `next analyze --compiler` 命令，可以可視化編譯器的優化決策：

```bash
# 查看哪些組件被 Compiler 優化了
next analyze --compiler --report

# 輸出示例：
# ✓ app/page.tsx:Home - 12 個 memoization 自動插入
# ✓ app/products/page.tsx:ProductList - 8 個 memoization 自動插入
# ⚠ app/dashboard/page.tsx:Chart - 跳過（包含 Math.random()）
# ✗ app/legacy/AdminPanel - 跳過（目錄被 exclude）
```

## 小結

- React 20 Compiler 零配置集成，PPR 正式穩定，靜態/動態內容自動分層
- 路由中間件支持嵌套層級，解決了鑑權、日誌等橫切關注點的組織問題
- Server Actions 事務化讓複雜業務操作變得安全可靠
- 編譯產物分析工具讓優化決策透明化
- Next.js 16 的核心思路是「編譯期做更多，運行時做更少」，這個方向是對的
