---
title: "Server Actions 設計模式"
date: 2023-01-11 16:06:36
tags:
  - 前端
readingTime: 3
description: "Server Actions 不只是替代 API 路由的語法糖，它改變了數據流的組織方式。在實際項目中，我們需要一套成熟的設計模式來管理校驗、錯誤處理、權限控制和狀態同步。這篇文章總結了我在生產環境中驗證過的幾種模式。"
wordCount: 432
---

Server Actions 不只是替代 API 路由的語法糖，它改變了數據流的組織方式。在實際項目中，我們需要一套成熟的設計模式來管理校驗、錯誤處理、權限控制和狀態同步。這篇文章總結了我在生產環境中驗證過的幾種模式。

## 模式一：Command 模式封裝業務邏輯

將 Server Action 按業務領域組織，每個 action 只做一件事。這比把所有 action 塞進一個 `actions.ts` 文件更可維護。

```tsx
// actions/post.ts
'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const createPostSchema = z.object({
  title: z.string().min(2, '標題至少2個字').max(100),
  content: z.string().min(10, '內容至少10個字'),
  categoryId: z.string().uuid(),
})

export type CreatePostResult =
  | { success: true; postId: string }
  | { success: false; errors: Record<string, string[]> }

export async function createPost(_: any, formData: FormData): Promise<CreatePostResult> {
  const user = await requireAuth()

  const raw = {
    title: formData.get('title'),
    content: formData.get('content'),
    categoryId: formData.get('categoryId'),
  }

  const parsed = createPostSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors }
  }

  const post = await db.post.create({
    data: { ...parsed.data, authorId: user.id },
  })

  revalidateTag('posts')
  redirect(`/blog/${post.slug}`)
}
```

`requireAuth()` 是獨立的鑑權函數，每個需要鑑權的 action 都調用它。不要用 middleware 做鑑權判斷，middleware 無法訪問數據庫 session。

## 模式二：Hook 化的 Action 調用

封裝一個自定義 hook，統一處理 loading、error、toast 反饋，避免在每個組件中重複 `useFormState` + `useTransition` 的樣板代碼。

```tsx
// hooks/use-action.ts
'use client'

import { useFormState } from 'react-dom'
import { useEffect } from 'react'
import { toast } from 'sonner'

interface Options<T> {
  onSuccess?: (data: T) => void
  onError?: (errors: Record<string, string[]>) => void
  successMessage?: string
}

export function useAction<T>(
  action: (state: any, formData: FormData) => Promise<T>,
  options: Options<T> = {}
) {
  const [state, formAction] = useFormState(action, null)

  useEffect(() => {
    if (!state) return

    if (state.success) {
      if (options.successMessage) toast.success(options.successMessage)
      options.onSuccess?.(state)
    } else if (state.errors) {
      if (options.onError) {
        options.onError(state.errors)
      } else {
        const firstError = Object.values(state.errors).flat()[0]
        toast.error(firstError)
      }
    }
  }, [state])

  return { state, formAction, pending: state === null }
}
```

```tsx
// 使用示例
'use client'

import { createComment } from '@/actions/comment'
import { useAction } from '@/hooks/use-action'

export function CommentForm({ postId }: { postId: string }) {
  const { formAction, state } = useAction(createComment, {
    successMessage: '評論已發佈',
    onSuccess: () => {
      // 可選：關閉彈窗、滾動到底部等
    },
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="postId" value={postId} />
      <textarea name="content" placeholder="寫下你的評論..." />
      {state?.errors?.content && (
        <p className="text-sm text-red-500">{state.errors.content[0]}</p>
      )}
      <button type="submit">提交評論</button>
    </form>
  )
}
```

## 模式三：事務性批量操作

有時一個用户操作需要更新多張表。Server Action 天然支持數據庫事務，不需要前端發多次請求。

```tsx
// actions/admin.ts
'use server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { revalidateTag } from 'next/cache'

export async function transferPosts(fromUserId: string, toUserId: string) {
  await requireAdmin()

  const result = await db.$transaction(async (tx) => {
    // 1. 轉移文章所有權
    const posts = await tx.post.updateMany({
      where: { authorId: fromUserId },
      data: { authorId: toUserId },
    })

    // 2. 更新目標用户的統計
    await tx.userStats.update({
      where: { userId: toUserId },
      data: { postCount: { increment: posts.count } },
    })

    // 3. 更新源用户的統計
    await tx.userStats.update({
      where: { userId: fromUserId },
      data: { postCount: 0 },
    })

    // 4. 記錄操作日誌
    await tx.auditLog.create({
      data: {
        action: 'TRANSFER_POSTS',
        operatorId: fromUserId,
        targetId: toUserId,
        metadata: { count: posts.count },
      },
    })

    return posts.count
  })

  revalidateTag('posts')
  revalidateTag('users')
  return { success: true, transferred: result }
}
```

## 模式四：樂觀更新 + 回滾

對於低風險操作（點贊、收藏、切換狀態），樂觀更新是最佳用户體驗方案。關鍵在於做好失敗回滾。

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleBookmark } from '@/actions/bookmark'

interface BookmarkState {
  bookmarked: boolean
  count: number
}

export function BookmarkToggle({ postId, initial }: {
  postId: string
  initial: BookmarkState
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    initial,
    (state, action: BookmarkState) => action
  )
  const [isPending, startTransition] = useTransition()

  async function handleToggle() {
    startTransition(async () => {
      setOptimistic({
        bookmarked: !optimistic.bookmarked,
        count: optimistic.bookmarked ? optimistic.count - 1 : optimistic.count + 1,
      })

      const result = await toggleBookmark(postId)
      // 如果失敗，useOptimistic 會自動回滾到 initial 狀態
      // 框架通過 Server Action 返回的最終狀態做 reconcile
    })
  }

  return (
    <button onClick={handleToggle} disabled={isPending}>
      {optimistic.bookmarked ? '★' : '☆'} {optimistic.count}
    </button>
  )
}
```

## 小結

- 用 zod 統一校驗 Server Action 輸入，永遠不要信任客户端數據
- 封裝 `useAction` hook 減少樣板代碼，統一 loading/error 處理
- Server Action 內可以直接用數據庫事務處理批量操作，前端不需要發多次請求
- 樂觀更新適合低風險操作，`useOptimistic` 框架級支持比手動實現更可靠
- 每個 action 都要鑑權，不要依賴 middleware 做權限控制