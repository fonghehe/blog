---
title: "Next.js 16の新機能：React 20コンパイラーとRoute Middleware"
date: 2025-01-09 10:00:00
tags:
  - React
readingTime: 3
description: "Next.js 16は2025年初頭にリリースされ、今回のアップデートで最も注目すべきは**React 20コンパイラーのデフォルト有効化**、**Route Middlewareの刷新**、そして**Transactional Server Actions**です。"
---

Next.js 16は2025年初頭にリリースされ、今回のアップデートで最も注目すべきは**React 20コンパイラーのデフォルト有効化**、**Route Middlewareの刷新**、そして**Transactional Server Actions**です。

> 注：本記事はNext.js 16 RCに基づいており、正式リリース時に一部変更となる場合があります。

## React 20コンパイラーのデフォルト有効化

Next.js 15はReact Compilerを`experimental`オプションとして導入しました。Next.js 16ではデフォルトで有効になります。

```javascript
// next.config.js — 16 ではデフォルトで有効（設定不要）
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 15 では experimental.reactCompiler: true が必要だったが
  // 16 では設定不要
};

export default nextConfig;
```

Compilerが有効になると、手動メモ化の多くは不要になります：

```typescript
// 以前：useMemo と useCallback を多用
function ProductList({ products, onSelect }: Props) {
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.price - b.price),
    [products]
  );

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect]
  );

  return (
    <ul>
      {sortedProducts.map((p) => (
        <ProductItem key={p.id} product={p} onSelect={handleSelect} />
      ))}
    </ul>
  );
}

// React 20 Compiler 有効時：コンパイラーが自動でメモ化を挿入
// useMemo / useCallback を書かなくても同等のパフォーマンスになる
function ProductList({ products, onSelect }: Props) {
  const sortedProducts = [...products].sort((a, b) => a.price - b.price);

  return (
    <ul>
      {sortedProducts.map((p) => (
        <ProductItem
          key={p.id}
          product={p}
          onSelect={(id) => onSelect(id)}
        />
      ))}
    </ul>
  );
}
```

## Route Middleware の刷新

Next.js 16のRoute Middlewareは`matcher`設定が強化されました。

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証チェック
  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // 16 の新機能：リクエストヘッダーを通じてページコンポーネントにデータを渡す
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-role", payload.role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 16 の新機能：否定先読みを使ったマッチャー
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

## Transactional Server Actions

これはNext.js 16で最も期待される新機能です——複数のServer Actionをトランザクションとしてグループ化し、どれか1つが失敗した場合はすべてロールバックします。

```typescript
// app/checkout/actions.ts
"use server";

import { transaction } from "next/server"; // 新 API
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

export async function checkoutAction(cartId: string, paymentMethodId: string) {
  // transaction() でラップされた操作はアトミックになる
  return transaction(async (tx) => {
    // 1. 在庫チェックと予約
    const cart = await tx.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) throw new Error("カートが見つかりません");

    // 在庫をチェックして減らす
    for (const item of cart.items) {
      const product = await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });

      if (product.stock < 0) {
        // トランザクションをロールバックして在庫を元に戻す
        throw new Error(`${product.name} の在庫が不足しています`);
      }
    }

    // 2. 注文作成
    const order = await tx.order.create({
      data: {
        userId: cart.userId,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
        total: cart.items.reduce(
          (sum, item) => sum + item.quantity * item.product.price,
          0,
        ),
      },
    });

    // 3. 決済処理（失敗すると在庫と注文が自動ロールバック）
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total * 100,
      currency: "jpy",
      payment_method: paymentMethodId,
      confirm: true,
    });

    // 4. 注文ステータス更新
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentIntentId: paymentIntent.id,
      },
    });

    revalidatePath("/orders");
    return { orderId: order.id };
  });
}
```

クライアントコンポーネントでの使用：

```typescript
// app/checkout/checkout-form.tsx
"use client";

import { useActionState } from "react";
import { checkoutAction } from "./actions";

export function CheckoutForm({ cartId }: { cartId: string }) {
  const [state, action, isPending] = useActionState(checkoutAction, null);

  return (
    <form action={action.bind(null, cartId)}>
      <PaymentElement />

      {state?.error && (
        <div className="error">{state.error}</div>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "処理中..." : "注文を確定する"}
      </button>
    </form>
  );
}
```

## まとめ

Next.js 16の3つのコアアップデートはいずれも直接的な開発体験の改善をもたらします——Compilerでメモ化の手間を省き、Transactional Server Actionsでデータの一貫性を保証し、Route Middlewareで認証ロジックを集中管理できます。既存のNext.js 15プロジェクトへのアップグレードは比較的スムーズで、特に破壊的変更はありません。
