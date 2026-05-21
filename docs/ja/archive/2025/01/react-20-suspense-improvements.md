---
title: "React 20 Suspenseの改善：SuspenseList、useSuspenseQuery、Selective Hydration"
date: 2025-01-16 10:00:00
tags:
  - React
readingTime: 3
description: "React 20はSuspenseの関連APIを強化しました。`SuspenseList`の安定版リリース、`useSuspenseQuery`フックの追加、そしてSelective Hydrationのパフォーマンス改善が含まれます。本記事では実践的な使用パターンを中心に紹介します。"
wordCount: 388
---

React 20はSuspenseの関連APIを強化しました。`SuspenseList`の安定版リリース、`useSuspenseQuery`フックの追加、そしてSelective Hydrationのパフォーマンス改善が含まれます。本記事では実践的な使用パターンを中心に紹介します。

## SuspenseList の安定版リリース

`SuspenseList`はReact 18で実験的に導入されていましたが、React 20でついに安定版になりました。複数の`<Suspense>`コンポーネントのフォールバック表示順序を制御できます。

```typescript
import { Suspense, SuspenseList } from "react";

function NewsFeed() {
  return (
    // revealOrder: "forwards" | "backwards" | "together"
    // tail: "collapsed" | "hidden"
    <SuspenseList revealOrder="forwards" tail="collapsed">
      {/* forwards: 上から順番にコンテンツが表示される（下が先に読み込み完了しても待つ）*/}
      <Suspense fallback={<ArticleSkeleton />}>
        <FeaturedArticle />
      </Suspense>

      <Suspense fallback={<ArticleSkeleton />}>
        <TrendingArticles />
      </Suspense>

      <Suspense fallback={<ArticleSkeleton />}>
        <RecommendedArticles />
      </Suspense>
    </SuspenseList>
  );
}
```

```typescript
// revealOrder の違い
// "forwards"：上から順に表示（ウォーターフォール効果）
// "backwards"：下から順に表示
// "together"：すべてが準備できたら一斉に表示（FOUC なし）

// tail の違い：
// tail なし：すべての Suspense のフォールバックが同時に表示される
// "collapsed"：現在表示中の Suspense の直後の1つだけフォールバックを表示
// "hidden"：まだ表示されていない Suspense のフォールバックを非表示にする
```

実践的な使用例——ダッシュボードレイアウト：

```typescript
function Dashboard() {
  return (
    <div className="dashboard">
      {/* メインコンテンツエリア：上から順に表示 */}
      <SuspenseList revealOrder="forwards" tail="collapsed">
        <Suspense fallback={<StatCardsSkeleton />}>
          <StatCards />
        </Suspense>

        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <RecentOrders />
        </Suspense>
      </SuspenseList>

      {/* サイドバー：独立して読み込む（SuspenseList 外） */}
      <Suspense fallback={<SidebarSkeleton />}>
        <DashboardSidebar />
      </Suspense>
    </div>
  );
}
```

## useSuspenseQuery：データフェッチとSuspenseの統合

React 20は`useSuspenseQuery`フックを追加し、データフェッチをSuspenseと宣言的に統合できるようになりました。

```typescript
import { useSuspenseQuery } from "react";
import { cache } from "react";

// cache() でデータフェッチ関数をメモ化（同じ引数なら再フェッチしない）
const fetchUser = cache(async (userId: string) => {
  const res = await fetch(`/api/users/${userId}`);
  if (!res.ok) throw new Error("ユーザーの取得に失敗しました");
  return res.json() as Promise<User>;
});

// コンポーネントはデータが「あること前提」で書ける（Suspense が読み込み中を担当）
function UserProfile({ userId }: { userId: string }) {
  // useSuspenseQuery：データが準備できるまでサスペンド（throw Promise）
  const user = useSuspenseQuery(fetchUser, userId);

  // ここに来た時点でデータは必ず存在する
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <UserStats userId={user.id} />
    </div>
  );
}

// 使用：Suspense でラップする
function UserPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  );
}
```

## Selective Hydration の改善

React 20はSelective Hydration（選択的ハイドレーション）のパフォーマンスを改善しました。ユーザーがインタラクションしたコンポーネントを優先的にハイドレーションします。

```typescript
// app/page.tsx (Next.js App Router)
import { Suspense } from "react";
import { HeavyInteractiveSection } from "./heavy-section";

export default function HomePage() {
  return (
    <main>
      {/* 静的コンテンツ：即座に表示 */}
      <Header />
      <HeroSection />

      {/* インタラクティブなセクション：Suspense でラップ */}
      {/* ユーザーがこのエリアをクリックすると、Reactは他のハイドレーションを中断して
          このコンポーネントを優先的にハイドレーションする */}
      <Suspense fallback={<SectionSkeleton />}>
        <HeavyInteractiveSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <RecommendationCarousel />
      </Suspense>

      <Footer />
    </main>
  );
}
```

### Hydration優先度のカスタマイズ

```typescript
// React 20 の新機能：ハイドレーション優先度をヒントで指定（実験的）
import { unstable_postpone } from "react";

function PrioritySection({ priority }: { priority: "high" | "low" }) {
  if (priority === "low") {
    // ハイドレーションを後回しにするヒント（ビューポート外など）
    unstable_postpone();
  }

  return <InteractiveContent />;
}
```

## SuspenseとErrorBoundaryの組み合わせ

```typescript
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function DataSection({ id }: { id: string }) {
  return (
    // ErrorBoundary で非同期エラーをキャッチ
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <div className="error-state">
          <p>データの読み込みに失敗しました：{error.message}</p>
          <button onClick={resetErrorBoundary}>再試行</button>
        </div>
      )}
    >
      {/* Suspense でローディング状態を表示 */}
      <Suspense fallback={<DataSkeleton />}>
        <DataContent id={id} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## まとめ

React 20のSuspense改善、特に`SuspenseList`の安定化と`useSuspenseQuery`の追加によって、データフェッチとローディング状態の管理が宣言的かつ予測可能になりました。Selective Hydrationの改善は、インタラクティブなSSRページのTTI（Time to Interactive）短縮に直接貢献します。
