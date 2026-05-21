---
title: "Next.js 14 App Router：RSC 本番環境実践"
date: 2023-10-05 10:05:03
tags:
  - Next.js
readingTime: 2
description: "Next.js 14 发布了。App Router 从实验性功能变成了推荐方案。是时候认真聊聊生产环境的实践经验了。"
wordCount: 301
---

Next.js 14 发布了。App Router 从实验性功能变成了推荐方案。是时候认真聊聊生产环境的实践经验了。

## App Router コアコンセプト

### 文件系统路由

```
app/
├── layout.tsx          # 根布局
├── page.tsx            # 首页 (/)
├── loading.tsx         # 首页 loading UI
├── error.tsx           # 首页错误边界
├── posts/
│   ├── layout.tsx      # Posts 布局
│   ├── page.tsx        # Posts 列表 (/posts)
│   ├── [id]/
│   │   ├── page.tsx    # Post 详情 (/posts/123)
│   │   └── not-found.tsx
└── api/
    └── route.ts        # API 路由
```

### 布局系统

```tsx
// app/layout.tsx - 根布局
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

// app/posts/layout.tsx - Posts 布局
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

布局在导航时不会重新渲染，保留客户端状态。这是 App Router 相比 Pages Router 最大的改进之一。

## Server Actions（Next.js 14 の新機能）

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
      <input name="title" placeholder="标题" required />
      <textarea name="content" placeholder="内容" required />
      <button type="submit">发布</button>
    </form>
  );
}
```

不需要手动写 API route + fetch + state 管理。`"use server"` 标记的函数可以直接在 Server Component 中调用，表单提交自动走 Server Action。

## ストリーミングレンダリングと Suspense

```tsx
// app/posts/page.tsx
import { Suspense } from "react";

async function PostList() {
  // 模拟慢查询
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
      {/* PostStats 和 PostList 并行加载 */}
      <Suspense fallback={<p>加载统计中...</p>}>
        <PostStats />
      </Suspense>
      <Suspense fallback={<PostListSkeleton />}>
        <PostList />
      </Suspense>
    </div>
  );
}
```

两个 Suspense 边界内的组件并行加载，先返回统计数字，文章列表后到。用户不会看到整体白屏。

## キャッシュ戦略

```tsx
// 默认缓存：fetch 自动缓存
const data = await fetch("https://api.example.com/posts");
// Next.js 默认 static，build 时获取一次

// 强制动态
const data = await fetch("https://api.example.com/posts", {
  cache: "no-store",
});

// 定时重新验证（ISR）
const data = await fetch("https://api.example.com/posts", {
  next: { revalidate: 60 }, // 60 秒后重新验证
});

// 按需重新验证
import { revalidateTag } from "next/cache";
// 在 Server Action 中
revalidateTag("posts");
```

## まとめ

- App Router + RSC 让 Next.js 从"更好的 SSR 框架"变成了"全栈 React 框架"
- Server Actions 消除了传统 API route + client fetch 的样板代码
- 布局系统在导航时保留状态，体验提升明显
- 流式渲染 + Suspense 让 TTFB 和 FCP 大幅改善
- 缓存策略粒度细但概念多，需要花时间理解默认行为