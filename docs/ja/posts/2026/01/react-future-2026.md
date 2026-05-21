---
title: "React 2026 将来の方向性"
date: 2026-01-23 10:00:00
tags:
  - React
readingTime: 4
description: "React 20のリリース以降、フレームワーク層の変化は落ち着いてきましたが、エコシステムと基盤アーキテクチャは引き続き急速に進化しています。React Compilerが成熟し、Server Componentsがデフォルトになり、新しい並行プリミティブがフロントエンドのデータ取得パターンを再定義しています。本記事で"
wordCount: 757
---

React 20のリリース以降、フレームワーク層の変化は落ち着いてきましたが、エコシステムと基盤アーキテクチャは引き続き急速に進化しています。React Compilerが成熟し、Server Componentsがデフォルトになり、新しい並行プリミティブがフロントエンドのデータ取得パターンを再定義しています。本記事ではReactの2026年におけるコアな変化と実際への影響をまとめます。

## React Compiler：手動memoが不要になった

React Compilerがついに正式に安定版になりました。`useMemo`、`useCallback`、`React.memo`——これらの手動最適化はすべてコンパイラが自動で処理するようになります。これは小さな変化ではありません——Reactのパフォーマンス最適化のメンタルモデルを根本から変えます。

```tsx
// 2024年のやり方：手動memoがあちこちに
import { memo, useMemo, useCallback } from "react";

const ProductCard = memo(function ProductCard({
  product,
  onSelect,
}: {
  product: Product;
  onSelect: (id: string) => void;
}) {
  const discount = useMemo(
    () => calculateDiscount(product.price, product.originalPrice),
    [product.price, product.originalPrice],
  );

  const handleClick = useCallback(
    () => onSelect(product.id),
    [onSelect, product.id],
  );

  return (
    <div onClick={handleClick}>
      <h3>{product.name}</h3>
      <span>{discount}% off</span>
    </div>
  );
});

// 2026年のやり方：コンパイラが自動で処理
// memo、useMemo、useCallbackが不要
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
// vite.config.ts —— React Compilerの設定
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      // React Compiler 2026の設定
      compiler: {
        target: "20",
        // コンパイラは自動的に分析・最適化するが、例外を設定できる
        dedupe: true,
        // 特定のファイルでコンパイラ最適化を無効化する
        ignorePatterns: ["**/*.test.tsx", "**/legacy/**"],
        // パフォーマンス分析モード：コンパイラが行った最適化を出力する
        report: "verbose",
      },
    }),
  ],
});
```

## Server Componentsの深掘り実践

RSCはもはや目新しいものではありませんが、多くのチームはいまだに「ページはServer Component、インタラクティブな部分はClient Component」というシンプルな使い方にとどまっています。RSCの真の価値はストリームレンダリング、並行データ取得、そしてサーバーアクションの深い活用にあります。

```tsx
// app/dashboard/page.tsx —— ストリームレンダリング＋並行取得
import { Suspense } from "react";

// 各コンポーネントが独自にデータを取得し、互いをブロックしない
export default function DashboardPage() {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 並行読み込み——先に返ってきた方が先に表示される */}
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <UserGrowthChart />
      </Suspense>

      {/* このコンポーネントは遅いかもしれないが、上のグラフをブロックしない */}
      <div className="col-span-2">
        <Suspense fallback={<TableSkeleton rows={10} />}>
          <RecentTransactions />
        </Suspense>
      </div>
    </div>
  );
}

// RevenueChart.tsx —— Server Componentでデータベースに直接クエリ
async function RevenueChart() {
  // APIレイヤー不要、データベースに直接アクセス
  const data = await db.query.revenue.aggregate({
    where: { date: { gte: subDays(new Date(), 30) } },
    groupBy: ["date"],
    orderBy: { date: "asc" },
  });

  return <ChartView data={data} />;
}

// RecentTransactions.tsx —— Server Actionを持つコンポーネント
async function RecentTransactions() {
  const transactions = await db.query.transactions.findMany({
    limit: 50,
    orderBy: { createdAt: "desc" },
  });

  async function approveTransaction(id: string) {
    "use server";
    await db.update(transactions).set({ status: "approved" }).where({ id });
    revalidatePath("/dashboard");
  }

  return (
    <TransactionTable data={transactions} onApprove={approveTransaction} />
  );
}
```

## 新しいActivity API

React 20で導入されたActivity APIは「非表示にするがアンマウントしない」シナリオを解決します。タブ切り替え、ルートナビゲーション、モーダルの背後のページ——これらのシナリオではかつて、コンポーネントをアンマウントして状態を失うか、CSSの`display:none`を使ってコンポーネントをバックグラウンドで実行し続けるかの選択しかありませんでした。

```tsx
// Activityを使ったタブパネルの実装
import { Activity, useState } from "react";

function TabPanels() {
  const [activeTab, setActiveTab] = useState<
    "orders" | "analytics" | "settings"
  >("orders");

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab("orders")}>注文</button>
        <button onClick={() => setActiveTab("analytics")}>分析</button>
        <button onClick={() => setActiveTab("settings")}>設定</button>
      </nav>

      {/* Activity mode="hidden"：DOMと状態を保持しつつ、副作用を一時停止する */}
      <Activity mode={activeTab === "orders" ? "visible" : "hidden"}>
        <OrdersPanel />
      </Activity>

      <Activity mode={activeTab === "analytics" ? "visible" : "hidden"}>
        <AnalyticsPanel />
      </Activity>

      <Activity mode={activeTab === "settings" ? "visible" : "hidden"}>
        <SettingsPanel />
      </Activity>
    </div>
  );
}

// 実際の効果：
// 1. タブを切り替えてもフォームの入力状態が失われない
// 2. 非表示パネル内のuseEffectとrequestAnimationFrameが自動的に一時停止される
// 3. 再表示時に自動的に再開し、再マウントしない
```

## ReactのView Transition統合

View Transitions APIとReactの統合により、ページ遷移アニメーションが驚くほどシンプルになりました。もうルート遷移にframer-motionは不要です。

```tsx
// View Transitionsを使ったルート遷移
import { useViewTransition } from "react";

function ProductList() {
  const transition = useViewTransition();

  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/products/${product.id}`}
          viewTransition
          // リストアイテムと詳細ページのメイン画像の間に共有要素トランジションを自動作成
          style={{ viewTransitionName: `product-${product.id}` }}
        >
          <ProductCard product={product} />
        </Link>
      ))}
    </div>
  );
}

// 詳細ページのメイン画像に同じviewTransitionNameを使用
// ブラウザがリストのサムネイルから詳細の大画像へのスムーズな遷移を自動的に作成する
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

## まとめ

- React Compilerが手動memoの精神的な負担を完全に排除した——過去3年間で最大のDX向上
- Server Componentsの真の価値は並行データ取得とストリームレンダリングにある。「SSRの代替品」というだけではない
- Activity APIがSPAの長年の問題「非表示コンポーネントの状態損失」を解決した
- View Transitions統合でルート遷移アニメーションに重いアニメーションライブラリが不要になった
- 2026年のReactのコアトレンド：開発者の認知負荷を削減し、コンパイラとランタイムにより多くを任せる
