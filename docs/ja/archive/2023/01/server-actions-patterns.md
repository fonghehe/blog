---
title: "Server Actions デザインパターン"
date: 2023-01-11 16:06:36
tags:
  - フロントエンド
readingTime: 4
description: "Server Actions は API ルートの代替となるシンタックスシュガーにとどまらず、データフローの編成方法を変革します。実際のプロジェクトでは、バリデーション、エラーハンドリング、権限制御、状態同期を管理するための成熟したデザインパターンが必要です。この記事では、本番環境で検証したいくつかのパターンをまとめました。"
wordCount: 815
---

Server Actions は API ルートの代替となるシンタックスシュガーにとどまらず、データフローの編成方法を変革します。実際のプロジェクトでは、バリデーション、エラーハンドリング、権限制御、状態同期を管理するための成熟したデザインパターンが必要です。この記事では、本番環境で検証したいくつかのパターンをまとめました。

## パターン1：ビジネスロジックの Command パターンカプセル化

Server Action をビジネスドメインごとに整理し、各アクションは1つのことだけを行います。すべてのアクションを1つの `actions.ts` ファイルに詰め込むよりも保守性が高まります。

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

`requireAuth()` は独立した認証関数であり、認証が必要な各アクションで呼び出します。middleware で認証判断を行わないでください。middleware はデータベースセッションにアクセスできません。

## パターン2：フック化した Action 呼び出し

カスタムフックをカプセル化して、loading、error、toast フィードバックを一元処理し、各コンポーネントで `useFormState` + `useTransition` のボイラープレートコードを繰り返すのを避けます。

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
// 使用例
'use client'

import { createComment } from '@/actions/comment'
import { useAction } from '@/hooks/use-action'

export function CommentForm({ postId }: { postId: string }) {
  const { formAction, state } = useAction(createComment, {
    successMessage: '评论已发布',
    onSuccess: () => {
      // オプション：モーダルを閉じる、下部へスクロールなど
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

## パターン3：トランザクション的バッチ操作

1つのユーザー操作で複数のテーブルを更新する必要がある場合があります。Server Action はデータベーストランザクションをネイティブサポートしており、フロントエンドから複数回リクエストを送信する必要はありません。

```tsx
// actions/admin.ts
'use server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { revalidateTag } from 'next/cache'

export async function transferPosts(fromUserId: string, toUserId: string) {
  await requireAdmin()

  const result = await db.$transaction(async (tx) => {
    // 1. 記事の所有権を移行
    const posts = await tx.post.updateMany({
      where: { authorId: fromUserId },
      data: { authorId: toUserId },
    })

    // 2. 移行先ユーザーの統計を更新
    await tx.userStats.update({
      where: { userId: toUserId },
      data: { postCount: { increment: posts.count } },
    })

    // 3. 移行元ユーザーの統計を更新
    await tx.userStats.update({
      where: { userId: fromUserId },
      data: { postCount: 0 },
    })

    // 4. 操作ログを記録
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

## パターン4：楽観的更新 + ロールバック

リスクの低い操作（いいね、ブックマーク、状態の切り替え）については、楽観的更新が最適なユーザー体験を提供します。重要なのは、失敗時のロールバックを適切に実装することです。

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
      // 失敗した場合、useOptimistic は自動的に initial 状態にロールバックする
      // フレームワークが Server Action から返された最終状態で reconcile を行う
    })
  }

  return (
    <button onClick={handleToggle} disabled={isPending}>
      {optimistic.bookmarked ? '★' : '☆'} {optimistic.count}
    </button>
  )
}
```

## まとめ

- zod を使用して Server Action の入力を統一バリデーションし、クライアントデータを決して信頼しない
- `useAction` フックをカプセル化してボイラープレートコードを削減し、loading/error 処理を統一する
- Server Action 内でデータベーストランザクションを使用してバッチ操作を直接処理でき、フロントエンドから複数回リクエストを送信する必要はない
- 楽観的更新はリスクの低い操作に適しており、`useOptimistic` のフレームワークレベルのサポートは手動実装よりも信頼性が高い
- 各アクションは認証を必要とし、middleware に権限制御を依存しない
