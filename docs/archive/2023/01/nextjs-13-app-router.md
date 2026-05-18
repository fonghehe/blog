---
title: "Next.js 13 App Router 完整指南"
date: 2023-01-02 09:31:03
tags:
  - Next.js
readingTime: 3
description: "Next.js 13 引入的 App Router 是自框架诞生以来最大的架构变革。它基于 React Server Components，重新定义了前后端代码的组织方式。对于已经在 Pages Router 上积累了大量项目的团队来说，理解 App Router 的核心概念是迁移的第一步。"
---

Next.js 13 引入的 App Router 是自框架诞生以来最大的架构变革。它基于 React Server Components，重新定义了前后端代码的组织方式。对于已经在 Pages Router 上积累了大量项目的团队来说，理解 App Router 的核心概念是迁移的第一步。

## 目录结构与约定式路由

App Router 使用 `app/` 目录，每个文件夹代表一个路由段。与 Pages Router 最大的不同是：`page.tsx` 只负责页面渲染，布局、加载态、错误处理各有专门文件。

```
app/
├── layout.tsx          // 根布局，所有页面共享
├── page.tsx            // 首页 /
├── loading.tsx         // 首页加载态
├── error.tsx           // 首页错误边界
├── blog/
│   ├── layout.tsx      // blog 路由的布局
│   ├── page.tsx        // /blog
│   └── [slug]/
│       └── page.tsx    // /blog/:slug
└── api/
    └── route.ts        // API 路由
```

每个 `page.tsx` 默认是 Server Component，这意味着你可以在里面直接 `await` 数据请求，无需 `useEffect`。

```tsx
// app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation'

interface Props {
  params: { slug: string }
}

async function getPost(slug: string) {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { revalidate: 60 } // ISR: 60秒重新验证
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

## 布局系统与状态保持

`layout.tsx` 是 App Router 最实用的特性之一。布局在路由切换时不会重新渲染，这意味着嵌套在布局中的状态可以跨页面保持。

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

关键区别：根布局**必须**包含 `<html>` 和 `<body>` 标签。布局不会在导航时重新挂载，但 `page.tsx` 会。这个特性天然解决了之前 Sidebar 重新渲染导致状态丢失的问题。

## 并行路由与拦截路由

App Router 支持用 `@folder` 实现并行路由，用 `(.)folder` 实现拦截路由。这两个特性组合起来，可以轻松实现 Modal 弹窗 + 背景保持的交互模式。

```tsx
// app/layout.tsx - 并行路由插槽
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

// app/@modal/(.)photo/[id]/page.tsx - 拦截路由
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

这种模式在 Pages Router 中实现非常复杂，需要手动管理 History API 和状态。App Router 把它变成了约定。

## 数据获取与缓存策略

App Router 的 `fetch` 被 Next.js 做了扩展，新增了 `cache` 和 `next.revalidate` 选项。默认行为是**请求级去重 + 永久缓存**，这与 Pages Router 完全不同。

```tsx
// 永久缓存（默认）
const data = await fetch('https://api.example.com/data')

// 60秒 ISR
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 60 }
})

// 每次请求都获取新数据
const data = await fetch('https://api.example.com/data', {
  cache: 'no-store'
})
```

对于非 `fetch` 的数据源（数据库、ORM），需要使用 `unstable_cache` API：

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

## 小结

- App Router 基于 React Server Components，默认组件在服务端运行，减少客户端 JS 体积
- 布局系统解决了跨页面状态保持问题，`loading.tsx` 和 `error.tsx` 让 UX 更完善
- 并行路由 + 拦截路由将复杂交互（如 Modal）变成了约定，大幅降低实现成本
- 缓存策略默认激进，需要根据业务场景主动选择 `revalidate` 或 `no-store`
- 目前 App Router 已经稳定，新项目建议直接使用，存量项目可以渐进式迁移