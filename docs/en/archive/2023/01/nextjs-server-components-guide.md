---
title: "Next.js 14 Server Actions in Practice"
date: 2023-01-04 10:05:17
tags:
  - Next.js
  - TypeScript
readingTime: 3
description: "Server Actions 是 Next.js 14 最核心的特性。它允许你在组件内部定义服务端函数，表单提交、按钮点击直接触发服务端逻辑，不再需要手动写 API 路由。这套机制从根本上改变了前后端数据交互的模式。"
wordCount: 465
---

Server Actions 是 Next.js 14 最核心的特性。它允许你在组件内部定义服务端函数，表单提交、按钮点击直接触发服务端逻辑，不再需要手动写 API 路由。这套机制从根本上改变了前后端数据交互的模式。

## Basic Usage and Form Handling

Server Actions 通过 `"use server"` 指令声明。可以直接绑定到表单的 `action` 属性，表单提交时自动在服务端执行。

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  if (!title || title.length < 2) {
    return { error: '标题至少2个字符' }
  }

  await db.post.create({
    data: { title, content, slug: title.toLowerCase().replace(/\s+/g, '-') }
  })

  revalidatePath('/blog')
  return { success: true }
}
```

```tsx
// app/blog/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost} className="max-w-xl mx-auto">
      <input name="title" placeholder="文章标题" required />
      <textarea name="content" rows={10} placeholder="文章内容" required />
      <button type="submit">发布文章</button>
    </form>
  )
}
```

注意这里没有 `useState` 管理表单状态，没有 `onSubmit` handler，没有 `fetch` 调用。整个数据流由框架处理。

## useFormState and Progressive Enhancement

在需要显示表单验证结果或乐观更新的场景，Next.js 14 提供了 `useFormState` hook。

```tsx
// app/actions.ts
'use server'

import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await authenticate(email, password)
  if (!user) {
    return { error: '邮箱或密码不正确', email }
  }

  await createSession(user.id)
  redirect('/dashboard')
}
```

```tsx
// app/login/page.tsx
'use client'

import { useFormState } from 'react-dom'
import { login } from '@/app/actions'
import { SubmitButton } from '@/components/SubmitButton'

export default function LoginPage() {
  const [state, formAction] = useFormState(login, null)

  return (
    <form action={formAction}>
      <input name="email" type="email" defaultValue={state?.email} required />
      <input name="password" type="password" required />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <SubmitButton>登录</SubmitButton>
    </form>
  )
}
```

`useFormState` 的第一个参数是 Server Action，第二个参数是初始状态。它会将 action 的返回值作为新的 state。即使 JavaScript 加载失败，表单也能正常提交（渐进式增强）。

## Server Actions and Optimistic Updates

`useOptimistic` 是 React 实验性 API，配合 Server Actions 可以实现丝滑的乐观更新体验。

```tsx
'use client'

import { useOptimistic } from 'react'
import { toggleLike } from '@/app/actions'

interface Post {
  id: string
  title: string
  liked: boolean
  likeCount: number
}

export function LikeButton({ post }: { post: Post }) {
  const [optimisticPost, addOptimistic] = useOptimistic(
    post,
    (state, action: 'like') => ({
      ...state,
      liked: !state.liked,
      likeCount: state.liked ? state.likeCount - 1 : state.likeCount + 1,
    })
  )

  return (
    <form action={async () => {
      addOptimistic('like')
      await toggleLike(post.id)
    }}>
      <button type="submit">
        {optimisticPost.liked ? '❤️' : '🤍'} {optimisticPost.likeCount}
      </button>
    </form>
  )
}
```

用户点击后 UI 立即更新，Server Action 在后台执行。如果请求失败，React 会自动回滚到原始状态。这比手动管理 loading state 要简洁得多。

## Practical Recommendations for Server Actions

在真实项目中，有几个实践值得注意：

```tsx
// 1. 使用 zod 做输入校验，不要信任前端
'use server'

import { z } from 'zod'

const schema = z.object({
  title: z.string().min(2).max(100),
  content: z.string().min(10),
  tags: z.array(z.string()).max(5).optional(),
})

export async function createPost(formData: FormData) {
  const raw = {
    title: formData.get('title'),
    content: formData.get('content'),
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors }
  }

  // ... 存储逻辑
}

// 2. Server Actions 可以从任何地方调用，不只是表单
// 适用于按钮点击、定时任务、事件触发等
export async function revalidateAll() {
  revalidateTag('posts')
  revalidateTag('users')
}
```

## Summary

- Server Actions 用 `"use server"` 声明，可以直接绑定表单的 `action` 属性，省去 API 路由的编写
- `useFormState` 处理表单状态和错误反馈，支持渐进式增强
- `useOptimistic` 配合 Server Actions 实现乐观更新，用户体验优于传统 loading 方案
- 服务端必须做输入校验（推荐 zod），不能信任客户端传来的数据
- Server Actions 目前适合表单提交、简单 CRUD 场景，复杂实时交互仍需要 API Routes