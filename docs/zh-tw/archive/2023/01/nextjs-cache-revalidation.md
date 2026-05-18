---
title: "Next.js 快取與重新驗證策略"
date: 2023-01-13 11:13:16
tags:
  - Next.js
readingTime: 3
description: "Next.js 13/14 的快取策略是所有框架中預設行為最激進的。理解 `fetch` 快取、`revalidate`、`revalidatePath`、`revalidateTag` 之間的區別和適用場景，是避免\"為什麼頁面資料不更新\"這類問題的關鍵。"
---

Next.js 13/14 的快取策略是所有框架中預設行為最激進的。理解 `fetch` 快取、`revalidate`、`revalidatePath`、`revalidateTag` 之間的區別和適用場景，是避免"為什麼頁面資料不更新"這類問題的關鍵。

## 快取層級全景

Next.js 的快取有四層，從外到內分別是：

1. **Request Memoization** — 同一請求中的重複 `fetch` 自動去重
2. **Data Cache** — `fetch` 響應的持久化快取，預設永久
3. **Full Route Cache** — 頁面級靜態快取，包含 RSC Payload + HTML
4. **Router Cache** — 客戶端路由快取，prefetch 的頁面快取

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  // 這個 fetch 被 Data Cache 快取，預設永久
  // 同一渲染請求中多處呼叫同一個 URL，會被 Request Memoization 去重
  const posts = await fetch('https://api.example.com/posts')

  // 這個 fetch 每次重新驗證
  const realtime = await fetch('https://api.example.com/stock-price', {
    cache: 'no-store'
  })

  // 這個 fetch 60秒後過期
  const trending = await fetch('https://api.example.com/trending', {
    next: { revalidate: 60 }
  })

  return <PostList posts={await posts.json()} />
}
```

## revalidatePath 與 revalidateTag 的區別

`revalidatePath` 按路徑失效快取，`revalidateTag` 按標籤失效。在 Server Actions 中，推薦使用 `revalidateTag`，因為它更精確。

```tsx
// 方式一：revalidatePath — 按路徑
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { ... } })
  // 失效 /blog 路徑下所有頁面的快取
  revalidatePath('/blog')
  // 也可以失效動態路由
  revalidatePath('/blog/[slug]', 'page')
  // 連佈局也一起失效
  revalidatePath('/blog', 'layout')
}

// 方式二：revalidateTag — 按標籤
// 在 fetch 時打標籤
const posts = await fetch('https://api.example.com/posts', {
  next: { tags: ['posts'] }
})

// 非 fetch 資料來源打標籤
import { unstable_cache } from 'next/cache'

const getPosts = unstable_cache(
  async () => db.post.findMany(),
  ['posts'],
  { tags: ['posts'] }
)

// 在 Server Action 中按標籤失效
'use server'
import { revalidateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { ... } })
  // 所有帶 'posts' 標籤的快取都失效
  revalidateTag('posts')
}
```

`revalidateTag` 的優勢在於：你不需要知道哪些頁面用了這個資料。只要資料帶了標籤，任何頁面的快取都會被正確失效。

## on-demand Revalidation vs 時間驅動 Revalidation

兩種策略適用不同場景：

```tsx
// 時間驅動：資料在指定秒數後過期
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 } // 1小時
})
// 適合：不經常變化的資料（如配置、分類列表）

// on-demand：由 Server Action 或 Route Handler 手動觸發
'use server'
export async function publishPost(postId: string) {
  await db.post.update({
    where: { id: postId },
    data: { status: 'published' }
  })
  revalidateTag('posts')
  revalidatePath('/blog')
}
// 適合：資料變更明確可追蹤的業務場景
```

我的建議是：優先用 on-demand revalidation。時間驅動的 revalidate 只用於那些真的沒有變更觸發點的資料（如第三方 API 返回的資料）。

## 非 fetch 資料來源的快取處理

資料庫查詢、檔案讀取等非 `fetch` 操作不會被自動快取。需要使用 `unstable_cache` 手動包裝。

```tsx
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'

// 基礎用法
const getCachedUser = unstable_cache(
  async (id: string) => {
    return db.user.findUnique({ where: { id } })
  },
  ['user'],       // key 的字首
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

## 快取除錯技巧

開發環境可以在 `next.config.js` 中啟用日誌來觀察快取行為：

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

控制台會輸出每個 `fetch` 的快取命中情況。生產環境可以用 `x-next-cache-tags` 和 `x-next-cache-status` 響應頭來除錯。

## 小結

- Next.js 預設快取行為非常激進，`fetch` 預設永久快取，需要理解後主動選擇策略
- 優先使用 `revalidateTag` + on-demand revalidation，比時間驅動更精確可控
- 非 fetch 資料來源（資料庫等）用 `unstable_cache` 包裝，否則不會被快取也不會被自動失效
- 開發時用 `logging.fetches` 配置來觀察快取命中情況，避免快取相關的詭異 bug
- `revalidatePath` 和 `revalidateTag` 是兩套不同維度的失效機制，根據場景選擇