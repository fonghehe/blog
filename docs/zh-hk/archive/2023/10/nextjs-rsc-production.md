---
title: "Next.js 14 App Router：RSC 生產環境實踐"
date: 2023-10-05 10:05:03
tags:
  - Next.js
readingTime: 2
description: "Next.js 14 發佈了。App Router 從實驗性功能變成了推薦方案。是時候認真聊聊生產環境的實踐經驗了。"
wordCount: 283
---

Next.js 14 發佈了。App Router 從實驗性功能變成了推薦方案。是時候認真聊聊生產環境的實踐經驗了。

## App Router 核心概念

### 文件系統路由

```
app/
├── layout.tsx          # 根佈局
├── page.tsx            # 首頁 (/)
├── loading.tsx         # 首頁 loading UI
├── error.tsx           # 首頁錯誤邊界
├── posts/
│   ├── layout.tsx      # Posts 佈局
│   ├── page.tsx        # Posts 列表 (/posts)
│   ├── [id]/
│   │   ├── page.tsx    # Post 詳情 (/posts/123)
│   │   └── not-found.tsx
└── api/
    └── route.ts        # API 路由
```

### 佈局系統

```tsx
// app/layout.tsx - 根佈局
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

// app/posts/layout.tsx - Posts 佈局
export default function PostsLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_300px]">
      <section>{children}</section>
      <aside>{sidebar}</aside>
    </div>
  );
}
```

佈局在導航時不會重新渲染，保留客户端狀態。這是 App Router 相比 Pages Router 最大的改進之一。

## Server Actions（Next.js 14 新增）

```tsx
// app/posts/actions.ts
"use server";

import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const post = await db.post.create({
    data: { title, content, authorId: getCurrentUser().id },
  });

  revalidatePath("/posts");
  return { id: post.id };
}

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidatePath("/posts");
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from "../actions";

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="標題" required />
      <textarea name="content" placeholder="內容" required />
      <button type="submit">發佈</button>
    </form>
  );
}
```

不需要手動寫 API route + fetch + state 管理。`"use server"` 標記的函數可以直接在 Server Component 中調用，表單提交自動走 Server Action。

## 流式渲染和 Suspense

```tsx
// app/posts/page.tsx
import { Suspense } from "react";

async function PostList() {
  // 模擬慢查詢
  const posts = await db.post.findMany({ take: 20 });
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  );
}

async function PostStats() {
  const stats = await db.post.aggregate({ _count: true });
  return <p>共 {stats._count} 篇文章</p>;
}

export default function PostsPage() {
  return (
    <div>
      <h1>文章列表</h1>
      {/* PostStats 和 PostList 並行加載 */}
      <Suspense fallback={<p>加載統計中...</p>}>
        <PostStats />
      </Suspense>
      <Suspense fallback={<PostListSkeleton />}>
        <PostList />
      </Suspense>
    </div>
  );
}
```

兩個 Suspense 邊界內的組件並行加載，先返回統計數字，文章列表後到。用户不會看到整體白屏。

## 緩存策略

```tsx
// 默認緩存：fetch 自動緩存
const data = await fetch("https://api.example.com/posts");
// Next.js 默認 static，build 時獲取一次

// 強制動態
const data = await fetch("https://api.example.com/posts", {
  cache: "no-store",
});

// 定時重新驗證（ISR）
const data = await fetch("https://api.example.com/posts", {
  next: { revalidate: 60 }, // 60 秒後重新驗證
});

// 按需重新驗證
import { revalidateTag } from "next/cache";
// 在 Server Action 中
revalidateTag("posts");
```

## 小結

- App Router + RSC 讓 Next.js 從"更好的 SSR 框架"變成了"全棧 React 框架"
- Server Actions 消除了傳統 API route + client fetch 的樣板代碼
- 佈局系統在導航時保留狀態，體驗提升明顯
- 流式渲染 + Suspense 讓 TTFB 和 FCP 大幅改善
- 緩存策略粒度細但概念多，需要花時間理解默認行為