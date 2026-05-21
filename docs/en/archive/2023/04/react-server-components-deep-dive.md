---
title: "React Server Components: Redefining the Frontend-Backend Boundary"
date: 2023-04-10 15:28:50
tags:
  - React
  - TypeScript
readingTime: 2
description: "React Server Components（RSC）不是又一个 SSR 方案。它是 React 团队对\"组件应该在哪里运行\"这个问题的全新回答。"
wordCount: 384
---

React Server Components（RSC）不是又一个 SSR 方案。它是 React 团队对"组件应该在哪里运行"这个问题的全新回答。

## SSR vs RSC

传统 SSR：服务端渲染 HTML，客户端 hydrate 成完整的 React 组件树。所有组件都有客户端 bundle。

RSC：组件只在服务端运行，不会出现在客户端 bundle 中。客户端只接收渲染结果（一种特殊的 JSON 格式）。

```
传统 SSR:
  Server: 渲染 HTML -> Client: 下载 JS -> Client: Hydrate 所有组件

RSC:
  Server: RSC 组件执行 -> 输出 RSC Payload -> Client: 只 hydrate Client 组件
```

## Server Component vs Client Component

```typescript
// 默认就是 Server Component
// app/posts/page.tsx（Next.js 14）

async function PostList() {
  // 直接访问数据库，不需要 API
  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
          {/* Server Component 里可以嵌套 Client Component */}
          <LikeButton postId={post.id} initialCount={post.likes} />
        </article>
      ))}
    </div>
  );
}

export default PostList;
```

```typescript
// 需要交互的组件用 'use client' 标记
"use client";

import { useState } from "react";

interface LikeButtonProps {
  postId: string;
  initialCount: number;
}

export function LikeButton({ postId, initialCount }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    setLiked(true);
    setCount((c) => c + 1);
    await fetch(`/api/posts/${postId}/like`, { method: "POST" });
  };

  return (
    <button onClick={handleLike} disabled={liked}>
      {liked ? "已点赞" : "点赞"} ({count})
    </button>
  );
}
```

核心原则：**默认 Server Component，需要 `useState`/`useEffect`/事件处理时才加 `'use client'`**。

## Revolution in Data Fetching Patterns

```typescript
// 传统模式：客户端获取
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser);
  }, [userId]);
  // loading state、error state、waterfall...
}

// RSC 模式：服务端直接获取
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) notFound();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
      <Suspense fallback={<FollowersSkeleton />}>
        <Followers userId={userId} />
      </Suspense>
    </div>
  );
}
```

没有 `useEffect`，没有 loading state 管理，没有 waterfalls。数据在服务端准备好，直接渲染。

## Practical Architectural Thinking

**什么时候用 Server Component：**
- 纯展示、不需要交互的组件
- 数据获取逻辑
- 访问后端资源（数据库、文件系统、内部服务）
- 敏感操作（token、密钥不暴露给客户端）

**什么时候用 Client Component：**
- 有 `useState`、`useEffect`
- 有事件处理（onClick、onChange）
- 使用浏览器 API
- 需要 context 的组件

**边界原则：** Client Component 应该尽量小、尽量在叶子节点。组件树的大部分应该是 Server Component。

## Summary

- RSC 不是 SSR 的替代，是全新的组件模型
- 默认 Server Component，需要交互时才标记 `'use client'`
- 消除了传统数据获取的 loading/waterfall 问题
- 服务端逻辑不暴露给客户端，安全性和 bundle 体积都有优势
- 需要转变心智模型：从"所有组件都在客户端"到"按需选择运行环境"