---
title: "React Server Components Deep Dive"
date: 2023-01-06 15:28:47
tags:
  - React
  - TypeScript
readingTime: 3
description: "React Server Components (RSC) 不是 SSR 的升级版，而是一个全新的渲染范式。SSR 生成 HTML 字符串，RSC 在服务端运行组件并将 React 树序列化到客户端。理解两者的区别，才能正确使用 Next.js 13/14 的 App Router。"
---

React Server Components (RSC) 不是 SSR 的升级版，而是一个全新的渲染范式。SSR 生成 HTML 字符串，RSC 在服务端运行组件并将 React 树序列化到客户端。理解两者的区别，才能正确使用 Next.js 13/14 的 App Router。

## Boundary Between Server and Client Components

默认情况下，App Router 中所有组件都是 Server Component。只有显式标记 `"use client"` 的组件才会在客户端运行。这个边界决定了代码能使用哪些能力。

```tsx
// components/UserList.tsx - Server Component（默认）
import { db } from '@/lib/db'
import { format } from 'date-fns'

export async function UserList() {
  // 可以直接数据库查询
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {/* 可以直接用 date-fns 这类库，不会打进客户端 bundle */}
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

关键原则：Server Component 不能用 `useState`、`useEffect`、事件处理器（`onClick` 等）。Client Component 可以使用所有 React API，但不能直接 `await` 数据库查询。

## Composition Pattern: Container and Presentational

RSC 最强大的能力是组合。Server Component 可以 import Client Component，但反过来不行。这天然形成了"容器/展示"的分层模式。

```tsx
// app/posts/page.tsx
import { Suspense } from 'react'
import { PostList } from '@/components/PostList'
import { PostFilters } from '@/components/PostFilters'
import { PostSkeleton } from '@/components/PostSkeleton'

export default function PostsPage() {
  return (
    <div>
      {/* PostFilters 是 Client Component，处理筛选交互 */}
      <PostFilters />

      {/* PostList 是 Server Component，内部 await 数据 */}
      <Suspense fallback={<PostSkeleton />}>
        <PostList />
      </Suspense>
    </div>
  )
}
```

这里的 `Suspense` 是服务端流式渲染的关键。`PostList` 获取数据时，`PostSkeleton` 作为 fallback 先发送到客户端，数据就绪后流式替换。这比 SSR 的"全有或全无"模式体验好很多。

## Serialization and Props Passing

Server Component 向 Client Component 传递 props 时，数据必须是可序列化的。函数、类实例、`Date` 对象都不能直接传递。

```tsx
// ❌ 错误：传递了函数
'use client'
export function Button({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick}>Click</button>
}

// Server Component 中
<Button onClick={() => console.log('hi')} /> // 运行时报错

// ✅ 正确：传递数据和 Server Action
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

这个限制看似苛刻，实际上是 RSC 安全模型的基础。Server Component 运行在服务端，它的函数引用在客户端根本不存在。

## Real-World Bundle Size Impact

RSC 最直接的收益是减小客户端 JavaScript 体积。Server Component 及其依赖（如 ORM、markdown 解析器）不会被打包到客户端。

```tsx
// 这个组件在服务端运行
import { compile } from '@mdx-js/mdx'        // ~500KB
import { highlight } from 'prismjs'           // ~200KB
import { db } from '@prisma/client'          // ~1.5MB

export async function PostContent({ slug }: { slug: string }) {
  const post = await db.post.findUnique({ where: { slug } })
  const highlighted = highlight(post.content, Prism.languages.js, 'js')
  const compiled = await compile(highlighted)
  return <div>{compiled}</div>
}

// 客户端 bundle 中不包含 @mdx-js/mdx、prismjs、@prisma/client
// 只保留 React 运行时 + 序列化后的渲染结果
```

在实际项目中，仅将重型依赖（如图表库、编辑器、PDF 处理）移入 Server Component，就能减少 30%-60% 的客户端 bundle 体积。

## Summary

- RSC 不是 SSR，组件在服务端运行并序列化为 React 树，而非 HTML 字符串
- `"use client"` 是 opt-in 机制，默认就是 Server Component，这是正确的默认值
- 序列化限制是安全模型的核心，Server Action 穿透了 Server/Client 边界
- `Suspense` + 流式渲染是 RSC 配套的 UX 解决方案，优于传统 SSR 的全有或全无
- 重型依赖放 Server Component，客户端 bundle 体积可以显著下降