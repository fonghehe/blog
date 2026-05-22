---
title: "Next.js 13 App Router 完整指南"
date: 2023-01-02 09:31:03
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 引入的 App Router 是自框架誕生以來最大的架構變革。它基於 React Server Components，重新定義了前後端程式碼的組織方式。對於已經在 Pages Router 上積累了大量專案的團隊來說，理解 App Router 的核心概念是遷移的第一步。"
wordCount: 596
---

Next.js 13 引入的 App Router 是自框架誕生以來最大的架構變革。它基於 React Server Components，重新定義了前後端程式碼的組織方式。對於已經在 Pages Router 上積累了大量專案的團隊來說，理解 App Router 的核心概念是遷移的第一步。

## 目錄結構與約定式路由

App Router 使用 `app/` 目錄，每個資料夾代表一個路由段。與 Pages Router 最大的不同是：`page.tsx` 隻負責頁面渲染，佈局、載入態、錯誤處理各有專門檔案。

```
app/
├── layout.tsx          // 根佈局，所有頁面共享
├── page.tsx            // 首頁 /
├── loading.tsx         // 首頁載入態
├── error.tsx           // 首頁錯誤邊界
├── blog/
│   ├── layout.tsx      // blog 路由的佈局
│   ├── page.tsx        // /blog
│   └── [slug]/
│       └── page.tsx    // /blog/:slug
└── api/
    └── route.ts        // API 路由
```

每個 `page.tsx` 預設是 Server Component，這意味著你可以在裡面直接 `await` 資料請求，無需 `useEffect`。

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

interface Props {
  params: { slug: string }
}

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { revalidate: 60 } // ISR: 60秒重新驗證
  })
  if (!res.ok) return null
  return res.json()
}

export default async function BlogPost({ params }: Props) {
  const post = await getPost(params.slug)
  if (!post) notFound()

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  )
}
```

## 佈局系統與狀態保持

`layout.tsx` 是 App Router 最實用的特性之一。佈局在路由切換時不會重新渲染，這意味著巢狀在佈局中的狀態可以跨頁面保持。

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'My Blog',
  description: 'A senior frontend blog'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}
```

關鍵區別：根佈局**必須**包含 `<html>` 和 `<body>` 標籤。佈局不會在導航時重新掛載，但 `page.tsx` 會。這個特性天然解決了之前 Sidebar 重新渲染導致狀態丟失的問題。

## 並行路由與攔截路由

App Router 支援用 `@folder` 實現並行路由，用 `(.)folder` 實現攔截路由。這兩個特性組合起來，可以輕鬆實現 Modal 彈窗 + 背景保持的互動模式。

```tsx
// app/layout.tsx - 並行路由插槽
export default function Layout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}

// app/@modal/(.)photo/[id]/page.tsx - 攔截路由
import { Modal } from '@/components/Modal'
import { getPhoto } from '@/lib/api'

export default async function PhotoModal({
  params,
}: {
  params: { id: string }
}) {
  const photo = await getPhoto(params.id)
  return (
    <Modal>
      <img src={photo.url} alt={photo.title} />
    </Modal>
  )
}
```

這種模式在 Pages Router 中實現非常複雜，需要手動管理 History API 和狀態。App Router 把它變成了約定。

## 資料獲取與快取策略

App Router 的 `fetch` 被 Next.js 做了擴充套件，新增了 `cache` 和 `next.revalidate` 選項。預設行為是**請求級去重 + 永久快取**，這與 Pages Router 完全不同。

```tsx
// 永久快取（預設）
const data = await fetch('https://api.example.com/data')

// 60秒 ISR
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})

// 每次請求都獲取新資料
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})
```

對於非 `fetch` 的資料來源（資料庫、ORM），需要使用 `unstable_cache` API：

```tsx
import { unstable_cache } from 'next/cache'

const getCachedPosts = unstable_cache(
  async () => {
    return db.posts.findMany({ orderBy: { createdAt: 'desc' } })
  },
  ['posts'],
  { revalidate: 3600, tags: ['posts'] }
)
```

## 小結

- App Router 基於 React Server Components，預設元件在服務端執行，減少客戶端 JS 體積
- 佈局系統解決了跨頁面狀態保持問題，`loading.tsx` 和 `error.tsx` 讓 UX 更完善
- 並行路由 + 攔截路由將複雜互動（如 Modal）變成了約定，大幅降低實現成本
- 快取策略預設激進，需要根據業務場景主動選擇 `revalidate` 或 `no-store`
- 目前 App Router 已經穩定，新專案建議直接使用，存量專案可以漸進式遷移