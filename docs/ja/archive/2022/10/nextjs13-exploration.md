---
title: "Next.js 13 初探：App Router の設計哲学"
date: 2022-10-11 16:06:02
tags:
  - Next.js
readingTime: 4
description: "Next.js 13 がリリースされ、App Router は大きなパラダイムの変化をもたらしました。正式版に先立ち、まずその設計哲学を理解しましょう——React Server Components、Streaming、ネストレイアウト。これらは段階的な改善ではなく、「フロントエンドはどう構築されるべきか」に対する再考です。"
wordCount: 679
---

Next.js 13がリリースされ、App Routerは大きなパラダイムシフトをもたらしました。正式版の前に、まずその設計哲学であるReact Server Components、Streaming、ネストレイアウトを理解しましょう。これらは段階的な改善ではなく、「フロントエンドはどう構築されるべきか」に対する再考です。

## Pages Router から App Router へ

```
Before (Pages Router):
pages/
├── index.tsx
├── about.tsx
└── blog/
    └── [slug].tsx

After (App Router):
app/
├── layout.tsx       # 根布局
├── page.tsx         # ホーム
├── loading.tsx      # ホーム加载状态
├── about/
│   └── page.tsx
└── blog/
    ├── [slug]/
    │   ├── page.tsx
    │   └── loading.tsx
    └── page.tsx
```

重要な違い：各フォルダは独自の `layout.tsx`、`loading.tsx`、`error.tsx` を持つことができます。

## React Server Components

```tsx
// app/posts/page.tsx — これは Server Component
// 'use client' なし、デフォルトでサーバーサイドで実行

async function PostsPage() {
  // コンポーネント内で直接データベースを呼び出す！APIは不要
  const posts = await db.posts.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div>
      <h1>文章列表</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

export default PostsPage;
```

このコンポーネントはブラウザにJSを送信しません。HTMLはサーバーサイドで直接レンダリングされます。クライアントが受け取るのは純粋なHTMLです。

## クライアントコンポーネント

```tsx
// app/components/like-button.tsx
'use client';

import { useState } from 'react';

export function LikeButton({ postId, initialCount }: {
  postId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);

  async function handleLike() {
    setLiked(true);
    setCount(c => c + 1);

    await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
  }

  return (
    <button onClick={handleLike} disabled={liked}>
      {liked ? '已点赞' : '点赞'} ({count})
    </button>
  );
}
```

`'use client'` ディレクティブは、これがクライアントコンポーネントであることを示します。JSがブラウザに送信されます。

## 組み合わせて使う

```tsx
// app/posts/[slug]/page.tsx — Server Component
import { LikeButton } from '@/components/like-button';
import { CommentSection } from '@/components/comment-section';

export default async function PostPage({ params }: {
  params: { slug: string };
}) {
  const post = await db.posts.findUnique({
    where: { slug: params.slug },
  });

  return (
    <article>
      {/* これらの内容はサーバーサイドでレンダリングされ、JSはゼロです */}
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      {/* これらは Client Component で、JSが読み込まれます */}
      <LikeButton postId={post.id} initialCount={post.likes} />
      <CommentSection postId={post.id} />
    </article>
  );
}
```

サーバーコンポーネントはデータ取得と静的コンテンツを担当し、クライアントコンポーネントはインタラクションを担当します。これが正しい役割分担です。

## ストリーミングと Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>ダッシュボード</h1>

      {/* これらのコンポーネントは独立して読み込めます */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

// 各子コンポーネントが独立してデータを取得
async function Stats() {
  const data = await fetch('/api/stats').then(r => r.json());
  return <div>{/* 渲染统计 */}</div>;
}
```

ブラウザがHTMLを受信した後、まずスケルトンスクリーンを表示します。データの準備ができたら、サーバーがStreamingを通じて段階的にコンテンツを送信します。クライアントがデータを再取得する必要はありません。

## ネストされたレイアウト

```tsx
// app/layout.tsx — 根布局
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <nav>
          <a href="/">ホーム</a>
          <a href="/dashboard">ダッシュボード</a>
        </nav>
        {children}
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx — ダッシュボード布局
export default function DashboardLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-layout">
      <aside>
        <DashboardSidebar />
      </aside>
      <main>{children}</main>
    </div>
  );
}
```

ダッシュボード页面会同时使用根布局和ダッシュボード布局。导航栏不会重新加载——这是 Pages Router 做不到的。

## データフェッチのパラダイムシフト

```tsx
// Before (Pages Router):
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}
export default function Page({ data }) { ... }

// After (App Router):
export default async function Page() {
  // 直接 await！コンポーネント自体が async です
  const data = await fetchData();
  return <div>{/* 使用 data */}</div>;
}
```

`getServerSideProps`/`getStaticProps` は不要になります。データ取得はコンポーネントの一部です。

## まとめ

Next.js 13のApp Routerは、従来のSPAパターンに対する根本的な再考です。Server Componentsは「どのコードがどこで実行されるか」を再定義し、Streamingはページがすべてのデータを待つ必要をなくし、ネストレイアウトはUI構造をより合理的にします。ただし、現時点ではまだベータ版です。本番プロジェクトでは安定してから移行することをお勧めします。