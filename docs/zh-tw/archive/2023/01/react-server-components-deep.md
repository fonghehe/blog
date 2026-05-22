---
title: "React Server Components 深入"
date: 2023-01-06 15:28:47
tags:
  - React
  - TypeScript
readingTime: 3
description: "React Server Components (RSC) 不是 SSR 的升級版，而是一個全新的渲染範式。SSR 生成 HTML 字串，RSC 在服務端執行元件並將 React 樹序列化到客戶端。理解兩者的區別，才能正確使用 Next.js 13/14 的 App Router。"
wordCount: 562
---

React Server Components (RSC) 不是 SSR 的升級版，而是一個全新的渲染範式。SSR 生成 HTML 字串，RSC 在服務端執行元件並將 React 樹序列化到客戶端。理解兩者的區別，才能正確使用 Next.js 13/14 的 App Router。

## Server Components 與 Client Components 的邊界

預設情況下，App Router 中所有元件都是 Server Component。隻有顯式標記 `"use client"` 的元件才會在客戶端執行。這個邊界決定了程式碼能使用哪些能力。

```tsx
// components/UserList.tsx - Server Component（預設）
import { db } from '@/lib/db'
import { format } from 'date-fns'

export async function UserList() {
  // 可以直接資料庫查詢
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {/* 可以直接用 date-fns 這類庫，不會打進客戶端 bundle */}
          <span>{user.name}</span>
          <time>{format(user.createdAt, 'yyyy-MM-dd')}</time>
          <LikeButton userId={user.id} initialCount={user.likeCount} />
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// components/LikeButton.tsx - Client Component
'use client'

import { useState } from 'react'

export function LikeButton({ userId, initialCount }: {
  userId: string
  initialCount: number
}) {
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)

  async function handleLike() {
    setPending(true)
    try {
      const res = await fetch(`/api/like/${userId}`, { method: 'POST' })
      const data = await res.json()
      setCount(data.count)
    } finally {
      setPending(false)
    }
  }

  return (
    <button onClick={handleLike} disabled={pending}>
      👍 {count}
    </button>
  )
}
```

關鍵原則：Server Component 不能用 `useState`、`useEffect`、事件處理器（`onClick` 等）。Client Component 可以使用所有 React API，但不能直接 `await` 資料庫查詢。

## 組合模式：容器與展示

RSC 最強大的能力是組合。Server Component 可以 import Client Component，但反過來不行。這天然形成了"容器/展示"的分層模式。

```tsx
// app/posts/page.tsx
import { Suspense } from 'react'
import { PostList } from '@/components/PostList'
import { PostFilters } from '@/components/PostFilters'
import { PostSkeleton } from '@/components/PostSkeleton'

export default function PostsPage() {
  return (
    <div>
      {/* PostFilters 是 Client Component，處理篩選互動 */}
      <PostFilters />

      {/* PostList 是 Server Component，內部 await 資料 */}
      <Suspense fallback={<PostSkeleton />}>
        <PostList />
      </Suspense>
    </div>
  )
}
```

這裡的 `Suspense` 是服務端流式渲染的關鍵。`PostList` 獲取資料時，`PostSkeleton` 作為 fallback 先發送到客戶端，資料就緒後流式替換。這比 SSR 的"全有或全無"模式體驗好很多。

## 序列化與 props 傳遞

Server Component 向 Client Component 傳遞 props 時，資料必須是可序列化的。函式、類例項、`Date` 物件都不能直接傳遞。

```tsx
// ❌ 錯誤：傳遞了函式
'use client'
export function Button({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click</button>
}

// Server Component 中
<Button onClick={() => console.log('hi')} /> // 執行時報錯

// ✅ 正確：傳遞資料和 Server Action
'use client'
export function Button({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button type="submit">Click</button>
    </form>
  )
}

// Server Component 中
import { saveData } from './actions'
<Button action={saveData} /> // Server Action 可以序列化
```

這個限製看似苛刻，實際上是 RSC 安全模型的基礎。Server Component 執行在服務端，它的函式引用在客戶端根本不存在。

## Bundle 體積的實際影響

RSC 最直接的收益是減小客戶端 JavaScript 體積。Server Component 及其依賴（如 ORM、markdown 解析器）不會被打包到客戶端。

```tsx
// 這個元件在服務端執行
import { compile } from '@mdx-js/mdx'        // ~500KB
import { highlight } from 'prismjs'           // ~200KB
import { db } from '@prisma/client'          // ~1.5MB

export async function PostContent({ slug }: { slug: string }) {
  const post = await db.post.findUnique({ where: { slug } })
  const highlighted = highlight(post.content, Prism.languages.js, 'js')
  const compiled = await compile(highlighted)
  return <div>{compiled}</div>
}

// 客戶端 bundle 中不包含 @mdx-js/mdx、prismjs、@prisma/client
// 隻保留 React 執行時 + 序列化後的渲染結果
```

在實際專案中，僅將重型依賴（如圖表庫、編輯器、PDF 處理）移入 Server Component，就能減少 30%-60% 的客戶端 bundle 體積。

## 小結

- RSC 不是 SSR，元件在服務端執行並序列化為 React 樹，而非 HTML 字串
- `"use client"` 是 opt-in 機製，預設就是 Server Component，這是正確的預設值
- 序列化限製是安全模型的核心，Server Action 穿透了 Server/Client 邊界
- `Suspense` + 流式渲染是 RSC 配套的 UX 解決方案，優於傳統 SSR 的全有或全無
- 重型依賴放 Server Component，客戶端 bundle 體積可以顯著下降