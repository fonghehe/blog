---
title: "Server Components 1年後：本番環境での教訓"
date: 2025-05-18 19:52:29
tags:
  - フロントエンド
readingTime: 3
description: "チームがNext.js 15でServer Componentsを本格的に使い始めて1年が経ちました。多くの落とし穴を踏み、多くのことを学びました。実践で得た知見をまとめます。"
wordCount: 292
---

チームがNext.js 15でServer Componentsを本格的に使い始めて1年が経ちました。多くの落とし穴を踏み、多くのことを学びました。実践で得た知見をまとめます。

## Server Componentsのメンタルモデル

```
コンポーネントの種類    実行環境           できること                  制約
───────────────────────────────────────────────────────────────────
Server Component        サーバー側         DB、ファイルシステム、        useState/useEffectは使えない
                        (Node/Edge)       API呼び出し、機密操作        ブラウザAPIは使えない

Client Component        ブラウザ           インタラクション、状態、       DBに直接アクセスできない
                        ("use client")   ライフサイクル、ブラウザAPI  JSバンドルサイズが増加
```

## 実践1：データ取得パターン

```tsx
// app/dashboard/page.tsx — Server ComponentでDBに直接クエリ
import { db } from "@/lib/db";
import { Suspense } from "react";

export default async function DashboardPage() {
  // 依存関係のないデータは並列取得
  const [stats, recentActivity] = await Promise.all([
    getStats(),
    getRecentActivity(),
  ]);

  return (
    <div className="grid gap-6">
      {/* 速いデータを先にレンダリング */}
      <StatsOverview stats={stats} />

      {/* 遅いデータはSuspenseでストリーミングロード */}
      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity data={recentActivity} />
      </Suspense>

      {/* サードパーティAPIは個別に処理 */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
    </div>
  );
}

// 独立したデータ取得関数
async function getStats() {
  const [userCount, orderCount, revenue] = await Promise.all([
    db.user.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { amount: true } }),
  ]);

  return { userCount, orderCount, revenue: revenue._sum.amount ?? 0 };
}
```

## 実践2：状態管理の境界

```tsx
// 誤り：Server Componentで状態を使用する
// エラーになる！
export default function Page() {
  const [count, setCount] = useState(0); // ❌ Server Componentは使えない
  return <div>{count}</div>;
}

// 正解：状態管理をClient Componentに落とす
// app/page.tsx — Server Component
import { Counter } from "./Counter";

export default async function Page() {
  const initialValue = await db.counter.findFirst();
  return <Counter initialValue={initialValue?.value ?? 0} />;
}

// components/Counter.tsx — Client Component
("use client");
import { useState } from "react";

export function Counter({ initialValue }: { initialValue: number }) {
  const [count, setCount] = useState(initialValue);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## 実践3：シリアライズの問題

```tsx
// 問題：Server Componentが渡すデータはシリアライズ可能でなければならない
// 関数、Dateオブジェクト、Map、Setなどは渡せない

// ❌ 誤り
export default async function Page() {
  const product = await db.product.findFirst();
  return <ProductCard product={product} />; // productにDateオブジェクトが含まれる
}

// ProductCard.tsx（Client Component）
("use client");
// Dateオブジェクトはシリアライズ後に文字列になっている！
// console.log(product.createdAt) → "2025-01-15T10:00:00.000Z"（文字列）

// ✅ 正解：明示的に変換する
export default async function Page() {
  const product = await db.product.findFirst();
  return (
    <ProductCard
      product={{
        ...product,
        createdAt: product.createdAt.toISOString(), // 明示的にシリアライズ
      }}
    />
  );
}

// またはClient Component側で処理する
("use client");
export function ProductCard({ product }: { product: SerializedProduct }) {
  const createdAt = new Date(product.createdAt); // デシリアライズ
  return <time>{createdAt.toLocaleDateString()}</time>;
}
```

## 実践4：エラーハンドリング

```tsx
// app/products/error.tsx — エラー境界
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
      <h2 className="text-lg font-semibold">読み込みに失敗しました</h2>
      <p className="text-muted-foreground mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4">
        再試行
      </button>
    </div>
  );
}

// Server Componentでのエラーハンドリング
export default async function ProductsPage() {
  try {
    const products = await db.product.findMany();
    return <ProductList products={products} />;
  } catch (error) {
    // Next.jsがこのエラーをキャッチし、error.tsxを表示する
    throw new Error("商品一覧の取得に失敗しました");
  }
}
```

## 実践5：パフォーマンス最適化

```tsx
// React.cache()でリクエストレベルの重複排除
import { cache } from "react";

// 同一リクエストは1つのSSRサイクル内で1度だけ実行される
const getUser = cache(async (id: string) => {
  console.log("ユーザーを取得:", id); // 1度しか表示されない
  return db.user.findUnique({ where: { id } });
});

// 複数のServer Componentで呼び出す
// Header.tsx
export async function Header() {
  const user = await getUser("current"); // クエリ実行
  return <nav>ようこそ、{user.name}</nav>;
}

// Sidebar.tsx
export async function Sidebar() {
  const user = await getUser("current"); // キャッシュにヒット、クエリ不要
  return <aside>役割: {user.role}</aside>;
}
```

## ハマりどころまとめ

```
1. "use client"の境界はできるだけ下に置く
   "use client"は最小のインタラクティブコンポーネントに置き、ページレベルには置かない

2. hydrationのミスマッチに注意
   ServerとClientのレンダリング結果は一致する必要がある
   よくある問題：Date.now()、Math.random()、Intlフォーマット

3. Server ComponentでContextは使えない
   Server ComponentはReactツリーの概念を持たない

4. フォームはServer Actionsを使う
   APIルートを手動で作成する必要がない

5. 画像はnext/imageを使う
   自動最適化、自動srcset生成
```

## まとめ

- Server Componentsの核心的な価値：クライアント側JSの削減、バックエンドリソースへの直接アクセス
- データ取得パターンを「useEffect + fetch」から「async/awaitで直接クエリ」に転換する
- シリアライズ問題が最もよくある落とし穴で、Date・Mapなどの型に特に注意
- "use client"の境界は下に置くほど良く、大部分のコンポーネントをServer Componentに保つ
- 1年を経て、Server Componentsは本番環境で成熟しており、全面的な採用に値する
