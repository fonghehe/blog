---
title: "Next.js 13 First Look: The Design Philosophy of App Router"
date: 2022-10-11 16:06:02
tags:
  - Next.js
readingTime: 2
description: "Next.js 13 is out, and the App Router brings a huge paradigm shift. Before the stable release, let's understand its design philosophy — React Server Components, streaming, and nested layouts. These aren't incremental improvements; they're a rethinking of how frontends should be built."
wordCount: 255
---

Next.js 13 is out, and the App Router brings a huge paradigm shift. Before the stable release, let's understand its design philosophy — React Server Components, streaming, and nested layouts. These aren't incremental improvements; they're a rethinking of how frontends should be built.

## From Pages Router to App Router

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
├── page.tsx         # 首页
├── loading.tsx      # 首页加载状态
├── about/
│   └── page.tsx
└── blog/
    ├── [slug]/
    │   ├── page.tsx
    │   └── loading.tsx
    └── page.tsx
```

Key difference: each folder can have its own `layout.tsx`, `loading.tsx`, and `error.tsx`.

## React Server Components

```tsx
// app/posts/page.tsx — 这是 Server Component
// 没有 'use client'，默认在服务端执行

async function PostsPage() {
  // 直接在组件里调用数据库！不需要 API
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

This component sends no JS to the browser — the HTML is rendered directly on the server. The client receives pure HTML.

## Client Components

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

The `'use client'` directive marks this as a client component — it sends JS to the browser.

## Combined Usage

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
      {/* 这些内容在服务端渲染，零 JS */}
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      {/* 这两个是 Client Component，会加载 JS */}
      <LikeButton postId={post.id} initialCount={post.likes} />
      <CommentSection postId={post.id} />
    </article>
  );
}
```

Server components handle data fetching and static content; client components handle interaction. This is the right division of labor.

## Streaming and Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>仪表盘</h1>

      {/* 这些组件可以独立加载 */}
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

// 每个子组件独立获取数据
async function Stats() {
  const data = await fetch('/api/stats').then(r => r.json());
  return <div>{/* 渲染统计 */}</div>;
}
```

After the browser receives the HTML, it shows a skeleton first. Once the data is ready, the server streams the filled-in content in chunks — no client-side refetch needed.

## Nested Layouts

```tsx
// app/layout.tsx — 根布局
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <nav>
          <a href="/">首页</a>
          <a href="/dashboard">仪表盘</a>
        </nav>
        {children}
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx — 仪表盘布局
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

The dashboard page uses both the root layout and the dashboard layout. The navigation bar doesn't reload — something the Pages Router can't do.

## Paradigm Shift in Data Fetching

```tsx
// Before (Pages Router):
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}
export default function Page({ data }) { ... }

// After (App Router):
export default async function Page() {
  // 直接 await！组件本身就是 async 的
  const data = await fetchData();
  return <div>{/* 使用 data */}</div>;
}
```

No more `getServerSideProps`/`getStaticProps` — data fetching is just part of the component.

## Summary

Next.js 13's App Router is a fundamental rethink of the traditional SPA model. Server Components redefine which code runs where, streaming frees pages from waiting on all the data, and nested layouts make the UI structure more sensible. It's still beta, though — for production projects I'd wait until it stabilizes before migrating.