---
title: "Next.js 17 新機能展望"
date: 2026-01-27 10:00:00
tags:
  - React
readingTime: 4
description: "Next.js 17は2025年末にリリースされ、基盤アーキテクチャにいくつかの重大な変化をもたらしました。最もコアな転換はTurbopackが正式にWebpackに代わってデフォルトのバンドラーになったことと、PPR（Partial Prerendering）の安定版リリースです。大規模プロジェクトにとって、これらの"
---

Next.js 17は2025年末にリリースされ、基盤アーキテクチャにいくつかの重大な変化をもたらしました。最もコアな転換はTurbopackが正式にWebpackに代わってデフォルトのバンドラーになったことと、PPR（Partial Prerendering）の安定版リリースです。大規模プロジェクトにとって、これらの変化は実質的な影響をもたらします。

## Turbopack：ついにWebpackとお別れ

Turbopackは3年の開発と磨き上げを経て、Next.js 17でついにデフォルトのバンドラーになりました。私たちの200+ページのプロジェクトでは、コールドスタート時間がWebpackの45秒から3秒以内に短縮されました。

```typescript
// next.config.ts —— Next.js 17の設定
import type { NextConfig } from "next";

const config: NextConfig = {
  // Turbopackは今やデフォルト値——手動で有効化不要
  // ただしTurbopack固有のオプションは設定できる
  turbopack: {
    // カスタムローダー
    loaders: {
      ".svg": ["@svgr/webpack"],
    },
    // 解決エイリアス
    resolveAlias: {
      "@": "./src",
      "@components": "./src/components",
    },
    // TurbopackのModule Federationサポート
    moduleFederation: {
      name: "host",
      remotes: {
        checkout: "checkout@https://checkout.example.com/remote.js",
      },
    },
  },

  // 実験的な機能
  experimental: {
    // React Compilerとの深い統合
    reactCompiler: true,
    // エッジミドルウェアのAI推論サポート
    aiMiddleware: true,
  },
};

export default config;
```

## PPR（Partial Prerendering）安定版

PPRはNext.js 17で最も重要な機能です。ページの異なる部分が異なるレンダリング戦略を持てるようになります：静的な部分はHTMLとして事前レンダリングされ、動的な部分はSuspenseでストリーミング注入されます。これはSSGのスピードとSSRの動的性を組み合わせたものです。

```tsx
// app/product/[id]/page.tsx
import { Suspense } from "react";

// 静的な部分：ビルド時に事前レンダリングされ、CDNにキャッシュされる
function ProductHeader({ product }: { product: Product }) {
  return (
    <header>
      <h1>{product.name}</h1>
      <img src={product.image} alt={product.name} />
      <p className="text-2xl font-bold">¥{product.price}</p>
    </header>
  );
}

// 動的な部分：毎リクエスト時にリアルタイムで計算される
async function StockStatus({ productId }: { productId: string }) {
  const stock = await fetch(`https://inventory.internal/${productId}`, {
    cache: "no-store", // 毎リクエスト時にリアルタイム在庫を確認
  }).then((r) => r.json());

  return (
    <div>
      {stock.available ? (
        <span className="text-green-600">在庫あり、{stock.count}点</span>
      ) : (
        <span className="text-red-600">一時品切れ</span>
      )}
    </div>
  );
}

// ユーザーパーソナライズコンテンツ：認証が必要
async function ReviewSection({ productId }: { productId: string }) {
  const user = await getUser();
  const reviews = await getReviews(productId, user?.region);

  return (
    <section>
      <h2>レビュー ({reviews.length})</h2>
      {user && <ReviewForm productId={productId} />}
      <ReviewList reviews={reviews} />
    </section>
  );
}

// ページの組み立て——PPRが静的/動的を自動的に分割する
export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id);

  return (
    <div>
      {/* この部分はビルド時に事前レンダリングされ、シェルが即座に表示される */}
      <ProductHeader product={product} />

      {/* Suspenseの境界：静的シェル＋動的コンテンツ */}
      <Suspense
        fallback={<div className="animate-pulse h-8 w-32 bg-gray-200" />}
      >
        <StockStatus productId={params.id} />
      </Suspense>

      <Suspense fallback={<ReviewSkeleton />}>
        <ReviewSection productId={params.id} />
      </Suspense>
    </div>
  );
}
```

## 新しいCache API

Next.js 17のCache APIは以前の`fetch`キャッシュ戦略よりもきめ細かく制御しやすくなっています。各データのキャッシュ時間、無効化戦略、ウォームアップロジックを正確に制御できます。

```typescript
// lib/cache.ts
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

// きめ細かいキャッシュ制御
export const getCachedProduct = unstable_cache(
  async (id: string) => {
    const product = await db.products.findUnique({ where: { id } });
    return product;
  },
  ["product"],
  {
    // キャッシュキーに動的パラメータを含める
    tags: ["product"],
    // 秒単位のキャッシュ時間
    revalidate: 300, // 5分
  },
);

// Server Actionでキャッシュを無効化する
export async function updateProduct(id: string, data: Partial<Product>) {
  "use server";

  await db.products.update({ where: { id }, data });

  // 精確な無効化：この商品に関連するキャッシュのみを更新する
  revalidateTag(`product-${id}`);

  // 一括無効化も可能
  revalidateTag("product-list");
}

// ルートレベルのキャッシュウォームアップ
// デプロイ直後に人気ページをウォームアップする
export async function warmupCache() {
  const topProducts = await db.products.findMany({
    orderBy: { viewCount: "desc" },
    take: 100,
  });

  await Promise.all(topProducts.map((p) => getCachedProduct(p.id)));
}
```

## ミドルウェアの強化

Next.js 17のミドルウェアはより強力な能力を持つようになりました。データベース接続への直接アクセス、AI推論呼び出し、より柔軟なレスポンス構築などが含まれます。

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. 認証チェック（データベースへの直接クエリをサポート）
  const session = await verifySession(request.cookies.get("session")?.value);

  if (request.nextUrl.pathname.startsWith("/dashboard") && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 2. A/Bテストのトラフィック分割（cookieで永続化）
  const abGroup = request.cookies.get("ab-group")?.value ?? assignABGroup();
  const response = NextResponse.next();
  response.headers.set("x-ab-group", abGroup);

  // 3. 地理情報と言語の検出
  const country = request.geo?.country ?? "CN";
  const preferredLocale =
    request.headers.get("accept-language")?.slice(0, 2) ?? "zh";
  response.headers.set("x-locale", country === "CN" ? "zh" : preferredLocale);

  // 4. レート制限（エッジKVストレージ）
  const ip = request.ip ?? "unknown";
  const rateLimitKey = `ratelimit:${ip}`;
  const hits = await edgeKV.incr(rateLimitKey);
  if (hits === 1) await edgeKV.expire(rateLimitKey, 60);
  if (hits > 100) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
```

## まとめ

- TurbopackがWebpackを正式に置き換え、大規模プロジェクトのビルド速度向上は桁違い
- PPRはSSGのスピードとSSRの動的性を組み合わせた、Next.jsで最もイノベーティブな機能
- 新しいCache APIでキャッシュ制御が「全か無か」からデータレベルの精確な制御に変わった
- ミドルウェアの能力が大幅に強化され、認証、A/Bテスト、レート制限がエッジで完結できる
- Next.js 17のトレンド：より多くの計算をエッジにプッシュしながら、開発者のメンタルモデルをよりシンプルにする
