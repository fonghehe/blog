---
title: "Server Actions Design Patterns"
date: 2023-01-11 16:06:36
tags:
  - Frontend
readingTime: 3
description: "Server Actions 不只是替代 API 路由的语法糖，它改变了数据流的组织方式。在实际项目中，我们需要一套成熟的设计模式来管理校验、错误处理、权限控制和状态同步。这篇文章总结了我在生产环境中验证过的几种模式。"
wordCount: 411
---

Server Actions 不只是替代 API 路由的语法糖，它改变了数据流的组织方式。在实际项目中，我们需要一套成熟的设计模式来管理校验、错误处理、权限控制和状态同步。这篇文章总结了我在生产环境中验证过的几种模式。

## Pattern 1: Command Pattern for Business Logic

将 Server Action 按业务领域组织，每个 action 只做一件事。这比把所有 action 塞进一个 `actions.ts` 文件更可维护。

```tsx
// actions/post.ts
'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const createPostSchema = z.object({
  title: z.string().min(2, '标题至少2个字').max(100),
  content: z.string().min(10, '内容至少10个字'),
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

`requireAuth()` 是独立的鉴权函数，每个需要鉴权的 action 都调用它。不要用 middleware 做鉴权判断，middleware 无法访问数据库 session。

## Pattern 2: Hook-Based Action Calls

封装一个自定义 hook，统一处理 loading、error、toast 反馈，避免在每个组件中重复 `useFormState` + `useTransition` 的样板代码。

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
    successMessage: '评论已发布',
    onSuccess: () => {
      // 可选：关闭弹窗、滚动到底部等
    },
  })

  return (
    <form action={formAction}>
      <input type="hidden" name="postId" value={postId} />
      <textarea name="content" placeholder="写下你的评论..." />
      {state?.errors?.content && (
        <p className="text-sm text-red-500">{state.errors.content[0]}</p>
      )}
      <button type="submit">提交评论</button>
    </form>
  )
}
```

## Pattern 3: Transactional Batch Operations

有时一个用户操作需要更新多张表。Server Action 天然支持数据库事务，不需要前端发多次请求。

```tsx
// actions/admin.ts
'use server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { revalidateTag } from 'next/cache'

export async function transferPosts(fromUserId: string, toUserId: string) {
  await requireAdmin()

  const result = await db.$transaction(async (tx) => {
    // 1. 转移文章所有权
    const posts = await tx.post.updateMany({
      where: { authorId: fromUserId },
      data: { authorId: toUserId },
    })

    // 2. 更新目标用户的统计
    await tx.userStats.update({
      where: { userId: toUserId },
      data: { postCount: { increment: posts.count } },
    })

    // 3. 更新源用户的统计
    await tx.userStats.update({
      where: { userId: fromUserId },
      data: { postCount: 0 },
    })

    // 4. 记录操作日志
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

## Pattern 4: Optimistic Updates + Rollback

对于低风险操作（点赞、收藏、切换状态），乐观更新是最佳用户体验方案。关键在于做好失败回滚。

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
      // 如果失败，useOptimistic 会自动回滚到 initial 状态
      // 框架通过 Server Action 返回的最终状态做 reconcile
    })
  }

  return (
    <button onClick={handleToggle} disabled={isPending}>
      {optimistic.bookmarked ? '★' : '☆'} {optimistic.count}
    </button>
  )
}
```

## Summary

- 用 zod 统一校验 Server Action 输入，永远不要信任客户端数据
- 封装 `useAction` hook 减少样板代码，统一 loading/error 处理
- Server Action 内可以直接用数据库事务处理批量操作，前端不需要发多次请求
- 乐观更新适合低风险操作，`useOptimistic` 框架级支持比手动实现更可靠
- 每个 action 都要鉴权，不要依赖 middleware 做权限控制