---
title: "Next.js 16 New Features Preview"
date: 2025-01-09 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 16 was officially released at Vercel Ship 2025, with the core theme of \"compilation as architecture\" — pushing more runtime logic to compile time to red"
wordCount: 299
---

Next.js 16 was officially released at Vercel Ship 2025, with the core theme of "compilation as architecture" — pushing more runtime logic to compile time to reduce the overhead between server and client boundaries. Native support for the React 20 Compiler, transactional Server Actions, and a brand-new Route Middleware system are the three biggest changes.

## React 20 Compiler — Zero-Config Support

Next.js 16 bundles the React 20 Compiler natively, requiring no manual Babel plugin installation. Compilation speed in Turbo mode is 40% faster than version 15.

```javascript
// next.config.ts - Minimal configuration
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactCompiler: {
    enabled: true,
    // Optional: only enable for specific paths
    include: ['app/(main)/**/*.{ts,tsx}'],
    exclude: ['**/*.test.tsx'],
  },
  experimental: {
    // Compiler-generated optimized code takes advantage of these runtime features
    ppr: true, // Partial Prerendering is now officially stable
  },
};

export default config;
```

PPR (Partial Prerendering) is officially stable in version 16. It splits a page into a static shell and dynamic slots — the static part is pre-rendered at edge nodes, while the dynamic part is streamed.

```tsx
// app/products/[id]/page.tsx
import { Suspense } from "react";

// Static part: generated at build time
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

// Dynamic part: streamed at request time
async function StockStatus({ id }: { id: string }) {
  const stock = await api.getLiveStock(id);
  return <span>{stock.available ? "有货" : "缺货"}</span>;
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

## Route Middleware

This is the most practical new feature in Next.js 16. Previously, middleware could only be written at the root-level `middleware.ts`. Now you can define middleware at any route level, forming a middleware chain.

```typescript
// app/api/auth/middleware.ts
import { NextResponse } from "next/server";
import type { MiddlewareFn } from "next";

export const middleware: MiddlewareFn = async (request) => {
  const token = request.cookies.get("session")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifyToken(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Inject user info into headers for downstream handlers
  const headers = new Headers(request.headers);
  headers.set("x-user-id", session.userId);
  headers.set("x-user-role", session.role);

  return NextResponse.next({ request: { headers } });
};

// app/api/admin/middleware.ts - Nested middleware
export const middleware: MiddlewareFn = async (request) => {
  const role = request.headers.get("x-user-role");
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next();
};
```

Route middleware executes from outer to inner (`app/api/auth/middleware.ts` → `app/api/admin/middleware.ts`), exactly like Express route hierarchy.

## Transactional Server Actions

Next.js 16 Server Actions support transactional execution — multiple actions can complete within a single database transaction:

```typescript
"use server";

import { db } from "@/lib/db";

export async function transferFunds(formData: FormData) {
  "use transaction"; // New directive: marks this as a transactional action

  const fromId = formData.get("fromAccount") as string;
  const toId = formData.get("toAccount") as string;
  const amount = Number(formData.get("amount"));

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

If any operation in the transaction fails, the entire operation is rolled back, the client receives structured error information, and React automatically rolls back optimistic updates.

## Bundle Analysis

Next.js 16 introduces the `next analyze --compiler` command to visualize the compiler's optimization decisions:

```bash
# See which components were optimized by the Compiler
next analyze --compiler --report

# Example output:
# ✓ app/page.tsx:Home - 12 memoizations auto-inserted
# ✓ app/products/page.tsx:ProductList - 8 memoizations auto-inserted
# ⚠ app/dashboard/page.tsx:Chart - skipped (contains Math.random())
# ✗ app/legacy/AdminPanel - skipped (directory is excluded)
```

## Summary

- React 20 Compiler integrated with zero config, PPR officially stable, static/dynamic content automatically layered
- Route middleware supports nested levels, solving the organizational challenge of cross-cutting concerns like authentication and logging
- Transactional Server Actions make complex business operations safe and reliable
- Bundle analysis tools make optimization decisions transparent
- Next.js 16's core philosophy is "do more at compile time, do less at runtime" — a sound direction
