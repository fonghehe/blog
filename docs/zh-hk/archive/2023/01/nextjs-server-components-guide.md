---
title: "Next.js 14 Server Actions 實戰"
date: 2023-01-04 10:05:17
tags:
  - Next.js
  - TypeScript
readingTime: 3
description: "Server Actions 是 Next.js 14 最核心的特性。它允許你在組件內部定義服務端函數，表單提交、按鈕點擊直接觸發服務端邏輯，不再需要手動寫 API 路由。這套機制從根本上改變了前後端數據交互的模式。"
wordCount: 479
---

Server Actions 是 Next.js 14 最核心的特性。它允許你在組件內部定義服務端函數，表單提交、按鈕點擊直接觸發服務端邏輯，不再需要手動寫 API 路由。這套機制從根本上改變了前後端數據交互的模式。

## 基礎用法與表單處理

Server Actions 通過 `"use server"` 指令聲明。可以直接綁定到表單的 `action` 屬性，表單提交時自動在服務端執行。

```tsx
// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  if (!title || title.length < 2) {
    return { error: '標題至少2個字符' }
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
      <input name="title" placeholder="文章標題" required />
      <textarea name="content" rows={10} placeholder="文章內容" required />
      <button type="submit">發佈文章</button>
    </form>
  )
}
```

注意這裏沒有 `useState` 管理表單狀態，沒有 `onSubmit` handler，沒有 `fetch` 調用。整個數據流由框架處理。

## useFormState 與漸進式增強

在需要顯示錶單驗證結果或樂觀更新的場景，Next.js 14 提供了 `useFormState` hook。

```tsx
// app/actions.ts
'use server'

import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await authenticate(email, password)
  if (!user) {
    return { error: '郵箱或密碼不正確', email }
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
      <SubmitButton>登錄</SubmitButton>
    </form>
  )
}
```

`useFormState` 的第一個參數是 Server Action，第二個參數是初始狀態。它會將 action 的返回值作為新的 state。即使 JavaScript 加載失敗，表單也能正常提交（漸進式增強）。

## Server Actions 與樂觀更新

`useOptimistic` 是 React 實驗性 API，配合 Server Actions 可以實現絲滑的樂觀更新體驗。

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

用户點擊後 UI 立即更新，Server Action 在後台執行。如果請求失敗，React 會自動回滾到原始狀態。這比手動管理 loading state 要簡潔得多。

## Server Actions 的實際項目建議

在真實項目中，有幾個實踐值得注意：

```tsx
// 1. 使用 zod 做輸入校驗，不要信任前端
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

  // ... 存儲邏輯
}

// 2. Server Actions 可以從任何地方調用，不只是表單
// 適用於按鈕點擊、定時任務、事件觸發等
export async function revalidateAll() {
  revalidateTag('posts')
  revalidateTag('users')
}
```

## 小結

- Server Actions 用 `"use server"` 聲明，可以直接綁定表單的 `action` 屬性，省去 API 路由的編寫
- `useFormState` 處理表單狀態和錯誤反饋，支持漸進式增強
- `useOptimistic` 配合 Server Actions 實現樂觀更新，用户體驗優於傳統 loading 方案
- 服務端必須做輸入校驗（推薦 zod），不能信任客户端傳來的數據
- Server Actions 目前適合表單提交、簡單 CRUD 場景，複雜實時交互仍需要 API Routes