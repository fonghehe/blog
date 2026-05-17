---
title: "Next.js 13 初探：App Router の設計哲学"
date: 2022-10-11 16:06:02
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 发布了，App Router 带来了巨大的范式变化。在正式版之前，让我们先理解它的设计哲学——React Server Components、Streaming、嵌套布局。这些不是渐进式改进，而是对「前端应该如何构建」的重新思考。"
---

Next.js 13 发布了，App Router 带来了巨大的范式变化。在正式版之前，让我们先理解它的设计哲学——React Server Components、Streaming、嵌套布局。这些不是渐进式改进，而是对「前端应该如何构建」的重新思考。

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

关键区别：每个文件夹可以有自己的 `layout.tsx`、`loading.tsx`、`error.tsx`。

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

这个组件不会发送任何 JS 到浏览器——HTML 直接在服务端渲染。客户端收到的是纯 HTML。

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

`'use client'` 指令标记这是一个客户端组件——会发送 JS 到浏览器。

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

服务端组件负责数据获取和静态内容，客户端组件负责交互。这才是正确的分工。

## ストリーミングと Suspense

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

浏览器收到 HTML 后，先显示骨架屏。数据准备好后，服务端通过 Streaming 逐段发送填充内容——不需要客户端重新获取数据。

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

仪表盘页面会同时使用根布局和仪表盘布局。导航栏不会重新加载——这是 Pages Router 做不到的。

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
  // 直接 await！组件本身就是 async 的
  const data = await fetchData();
  return <div>{/* 使用 data */}</div>;
}
```

不再需要 `getServerSideProps`/`getStaticProps`——数据获取就是组件的一部分。

## まとめ

Next.js 13 的 App Router 是对传统 SPA 模式的根本反思。Server Components 重新定义了「哪些代码在哪里运行」，Streaming 让页面不再需要等待所有数据，嵌套布局让 UI 结构更合理。但目前还是 beta，生产项目建议等稳定后再迁移。