---
title: "Next.js 缓存与重新验证策略"
date: 2023-01-13 11:13:16
tags:
  - Next.js
readingTime: 3
description: "Next.js 13/14 的缓存策略是所有框架中默认行为最激进的。理解 `fetch` 缓存、`revalidate`、`revalidatePath`、`revalidateTag` 之间的区别和适用场景，是避免\"为什么页面数据不更新\"这类问题的关键。"
wordCount: 531
---

Next.js 13/14 的缓存策略是所有框架中默认行为最激进的。理解 `fetch` 缓存、`revalidate`、`revalidatePath`、`revalidateTag` 之间的区别和适用场景，是避免"为什么页面数据不更新"这类问题的关键。

## 缓存层级全景

Next.js 的缓存有四层，从外到内分别是：

1. **Request Memoization** — 同一请求中的重复 `fetch` 自动去重
2. **Data Cache** — `fetch` 响应的持久化缓存，默认永久
3. **Full Route Cache** — 页面级静态缓存，包含 RSC Payload + HTML
4. **Router Cache** — 客户端路由缓存，prefetch 的页面缓存

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  // 这个 fetch 被 Data Cache 缓存，默认永久
  // 同一渲染请求中多处调用同一个 URL，会被 Request Memoization 去重
  const posts = await fetch('https://api.example.com/posts')

  // 这个 fetch 每次重新验证
  const realtime = await fetch('https://api.example.com/stock-price', {
    cache: 'no-store'
  })

  // 这个 fetch 60秒后过期
  const trending = await fetch('https://api.example.com/trending', {
    next: { revalidate: 60 }
  })

  return <PostList posts={await posts.json()} />
}
```

## revalidatePath 与 revalidateTag 的区别

`revalidatePath` 按路径失效缓存，`revalidateTag` 按标签失效。在 Server Actions 中，推荐使用 `revalidateTag`，因为它更精确。

```tsx
// 方式一：revalidatePath — 按路径
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { ... } })
  // 失效 /blog 路径下所有页面的缓存
  revalidatePath('/blog')
  // 也可以失效动态路由
  revalidatePath('/blog/[slug]', 'page')
  // 连布局也一起失效
  revalidatePath('/blog', 'layout')
}

// 方式二：revalidateTag — 按标签
// 在 fetch 时打标签
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
})

// 非 fetch 数据源打标签
import { unstable_cache } from 'next/cache'

const getPosts = unstable_cache(
  async () => db.post.findMany(),
  ['posts'],
  { tags: ['posts'] }
)

// 在 Server Action 中按标签失效
'use server'
import { revalidateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { ... } })
  // 所有带 'posts' 标签的缓存都失效
  revalidateTag('posts')
}
```

`revalidateTag` 的优势在于：你不需要知道哪些页面用了这个数据。只要数据带了标签，任何页面的缓存都会被正确失效。

## on-demand Revalidation vs 时间驱动 Revalidation

两种策略适用不同场景：

```tsx
// 时间驱动：数据在指定秒数后过期
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 } // 1小时
})
// 适合：不经常变化的数据（如配置、分类列表）

// on-demand：由 Server Action 或 Route Handler 手动触发
'use server'
export async function publishPost(postId: string) {
  await db.post.update({
    where: { id: postId },
    data: { status: 'published' }
  })
  revalidateTag('posts')
  revalidatePath('/blog')
}
// 适合：数据变更明确可追踪的业务场景
```

我的建议是：优先用 on-demand revalidation。时间驱动的 revalidate 只用于那些真的没有变更触发点的数据（如第三方 API 返回的数据）。

## 非 fetch 数据源的缓存处理

数据库查询、文件读取等非 `fetch` 操作不会被自动缓存。需要使用 `unstable_cache` 手动包装。

```tsx
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'

// 基础用法
const getCachedUser = unstable_cache(
  async (id: string) => {
    return db.user.findUnique({ where: { id } })
  },
  ['user'],       // key 的前缀
  { revalidate: 3600, tags: ['users'] }
)

// 在 Server Component 中使用
export default async function ProfilePage({ params }: { params: { id: string } }) {
  const user = await getCachedUser(params.id)
  if (!user) notFound()

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  )
}

// 在 Server Action 中失效
'use server'
import { revalidateTag } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const id = formData.get('id') as string
  await db.user.update({
    where: { id },
    data: { bio: formData.get('bio') }
  })
  revalidateTag('users')
}
```

## 缓存调试技巧

开发环境可以在 `next.config.js` 中启用日志来观察缓存行为：

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}

module.exports = nextConfig
```

控制台会输出每个 `fetch` 的缓存命中情况。生产环境可以用 `x-next-cache-tags` 和 `x-next-cache-status` 响应头来调试。

## 小结

- Next.js 默认缓存行为非常激进，`fetch` 默认永久缓存，需要理解后主动选择策略
- 优先使用 `revalidateTag` + on-demand revalidation，比时间驱动更精确可控
- 非 fetch 数据源（数据库等）用 `unstable_cache` 包装，否则不会被缓存也不会被自动失效
- 开发时用 `logging.fetches` 配置来观察缓存命中情况，避免缓存相关的诡异 bug
- `revalidatePath` 和 `revalidateTag` 是两套不同维度的失效机制，根据场景选择