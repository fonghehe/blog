---
title: "Next.js 13 初探：App Router 的設計哲學"
date: 2022-10-11 16:06:02
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 釋出了，App Router 帶來了巨大的範式變化。在正式版之前，讓我們先理解它的設計哲學——React Server Components、Streaming、巢狀佈局。這些不是漸進式改進，而是對「前端應該如何構建」的重新思考。"
---

Next.js 13 釋出了，App Router 帶來了巨大的範式變化。在正式版之前，讓我們先理解它的設計哲學——React Server Components、Streaming、巢狀佈局。這些不是漸進式改進，而是對「前端應該如何構建」的重新思考。

## 從 Pages Router 到 App Router

```
Before (Pages Router):
pages/
├── index.tsx
├── about.tsx
└── blog/
    └── [slug].tsx

After (App Router):
app/
├── layout.tsx       # 根佈局
├── page.tsx         # 首頁
├── loading.tsx      # 首頁載入狀態
├── about/
│   └── page.tsx
└── blog/
    ├── [slug]/
    │   ├── page.tsx
    │   └── loading.tsx
    └── page.tsx
```

關鍵區別：每個資料夾可以有自己的 `layout.tsx`、`loading.tsx`、`error.tsx`。

## React Server Components

```tsx
// app/posts/page.tsx — 這是 Server Component
// 沒有 'use client'，預設在服務端執行

async function PostsPage() {
  // 直接在元件裡呼叫資料庫！不需要 API
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

這個元件不會發送任何 JS 到瀏覽器——HTML 直接在服務端渲染。客戶端收到的是純 HTML。

## Client Component

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
      {liked ? '已點贊' : '點贊'} ({count})
    </button>
  );
}
```

`'use client'` 指令標記這是一個客戶端元件——會發送 JS 到瀏覽器。

## 組合使用

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
      {/* 這些內容在服務端渲染，零 JS */}
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      {/* 這兩個是 Client Component，會載入 JS */}
      <LikeButton postId={post.id} initialCount={post.likes} />
      <CommentSection postId={post.id} />
    </article>
  );
}
```

服務端元件負責資料獲取和靜態內容，客戶端元件負責互動。這才是正確的分工。

## Streaming 與 Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>儀表盤</h1>

      {/* 這些元件可以獨立載入 */}
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

// 每個子元件獨立獲取資料
async function Stats() {
  const data = await fetch('/api/stats').then(r => r.json());
  return <div>{/* 渲染統計 */}</div>;
}
```

瀏覽器收到 HTML 後，先顯示骨架屏。資料準備好後，服務端通過 Streaming 逐段傳送填充內容——不需要客戶端重新獲取資料。

## 巢狀佈局

```tsx
// app/layout.tsx — 根佈局
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <nav>
          <a href="/">首頁</a>
          <a href="/dashboard">儀表盤</a>
        </nav>
        {children}
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx — 儀表盤佈局
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

儀表盤頁面會同時使用根佈局和儀表盤佈局。導航欄不會重新載入——這是 Pages Router 做不到的。

## 資料獲取的範式變化

```tsx
// Before (Pages Router):
export async function getServerSideProps() {
  const data = await fetchData();
  return { props: { data } };
}
export default function Page({ data }) { ... }

// After (App Router):
export default async function Page() {
  // 直接 await！元件本身就是 async 的
  const data = await fetchData();
  return <div>{/* 使用 data */}</div>;
}
```

不再需要 `getServerSideProps`/`getStaticProps`——資料獲取就是元件的一部分。

## 小結

Next.js 13 的 App Router 是對傳統 SPA 模式的根本反思。Server Components 重新定義了「哪些程式碼在哪裡執行」，Streaming 讓頁面不再需要等待所有資料，巢狀佈局讓 UI 結構更合理。但目前還是 beta，生產專案建議等穩定後再遷移。