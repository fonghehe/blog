---
title: "React Server Components：重新定義前後端邊界"
date: 2023-04-10 15:28:50
tags:
  - React
  - TypeScript
readingTime: 2
description: "React Server Components（RSC）不是又一個 SSR 方案。它是 React 團隊對\"組件應該在哪裏運行\"這個問題的全新回答。"
wordCount: 392
---

React Server Components（RSC）不是又一個 SSR 方案。它是 React 團隊對"組件應該在哪裏運行"這個問題的全新回答。

## SSR vs RSC

傳統 SSR：服務端渲染 HTML，客户端 hydrate 成完整的 React 組件樹。所有組件都有客户端 bundle。

RSC：組件隻在服務端運行，不會出現在客户端 bundle 中。客户端隻接收渲染結果（一種特殊的 JSON 格式）。

```
傳統 SSR:
  Server: 渲染 HTML -> Client: 下載 JS -> Client: Hydrate 所有組件

RSC:
  Server: RSC 組件執行 -> 輸出 RSC Payload -> Client: 隻 hydrate Client 組件
```

## Server Component vs Client Component

```typescript
// 默認就是 Server Component
// app/posts/page.tsx（Next.js 14）

async function PostList() {
  // 直接訪問數據庫，不需要 API
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
          {/* Server Component 裏可以嵌套 Client Component */}
          <LikeButton postId={post.id} initialCount={post.likes} />
        </article>
      ))}
    </div>
  );
}

export default PostList;
```

```typescript
// 需要交互的組件用 'use client' 標記
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
      {liked ? "已點贊" : "點贊"} ({count})
    </button>
  );
}
```

核心原則：**默認 Server Component，需要 `useState`/`useEffect`/事件處理時才加 `'use client'`**。

## 數據獲取模式的變革

```typescript
// 傳統模式：客户端獲取
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser);
  }, [userId]);
  // loading state、error state、waterfall...
}

// RSC 模式：服務端直接獲取
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

沒有 `useEffect`，沒有 loading state 管理，沒有 waterfalls。數據在服務端準備好，直接渲染。

## 實際架構思考

**什麼時候用 Server Component：**
- 純展示、不需要交互的組件
- 數據獲取邏輯
- 訪問後端資源（數據庫、文件系統、內部服務）
- 敏感操作（token、密鑰不暴露給客户端）

**什麼時候用 Client Component：**
- 有 `useState`、`useEffect`
- 有事件處理（onClick、onChange）
- 使用瀏覽器 API
- 需要 context 的組件

**邊界原則：** Client Component 應該儘量小、儘量在葉子節點。組件樹的大部分應該是 Server Component。

## 小結

- RSC 不是 SSR 的替代，是全新的組件模型
- 默認 Server Component，需要交互時才標記 `'use client'`
- 消除了傳統數據獲取的 loading/waterfall 問題
- 服務端邏輯不暴露給客户端，安全性和 bundle 體積都有優勢
- 需要轉變心智模型：從"所有組件都在客户端"到"按需選擇運行環境"