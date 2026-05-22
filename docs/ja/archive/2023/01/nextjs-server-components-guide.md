---
title: "Next.js 14 Server Actions 実践"
date: 2023-01-04 10:05:17
tags:
  - Next.js
  - TypeScript
readingTime: 4
description: "Server Actions は Next.js 14 の最も核心的な機能です。コンポーネント内部でサーバーサイド関数を定義でき、フォーム送信やボタンクリックで直接サーバーサイドロジックを起動するため、API ルートを手動で書く必要がなくなります。この仕組みは、フロントエンドとバックエンドのデータ連携のパターンを根本的に変えます。"
wordCount: 820
---

Server Actions は Next.js 14 の最も核心的な機能です。コンポーネント内部でサーバーサイド関数を定義でき、フォーム送信やボタンクリックで直接サーバーサイドロジックを起動するため、APIルートを手動で書く必要がなくなります。この仕組みは、フロントエンドとバックエンドのデータ連携のパターンを根本的に変えます。

## 基本的な使い方とフォーム処理

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
    return { error: 'タイトルは最低2文字必要です' }
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
      <input name="title" placeholder="記事のタイトル" required />
      <textarea name="content" rows={10} placeholder="記事の内容" required />
      <button type="submit">記事を公開</button>
    </form>
  )
}
```

ここでは `useState` によるフォーム状態管理、`onSubmit` ハンドラ、`fetch` 呼び出しが一切ないことに注意してください。データフローはすべてフレームワークが処理します。

## useFormState とプログレッシブエンハンスメント

フォームのバリデーション結果や楽観的更新を表示する必要があるシナリオでは、Next.js 14 は `useFormState` hook を提供しています。

```tsx
// app/actions.ts
'use server'

import { redirect } from 'next/navigation'

export async function login(prevState: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await authenticate(email, password)
  if (!user) {
    return { error: 'メールアドレスまたはパスワードが正しくありません', email }
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
      <SubmitButton>ログイン</SubmitButton>
    </form>
  )
}
```

`useFormState` の第一引数は Server Action、第二引数は初期状態です。action の戻り値を新しい state として設定します。JavaScript の読み込みに失敗しても、フォームは正常に送信できます（プログレッシブエンハンスメント）。

## Server Actions と楽観的更新

`useOptimistic` は React の実験的APIで、Server Actions と組み合わせることでスムーズな楽観的更新を実現できます。

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

ユーザーがクリックするとUIが即座に更新され、Server Action がバックグラウンドで実行されます。リクエストが失敗した場合、React は自動的に元の状態にロールバックします。これは手動で loading state を管理するよりもはるかにシンプルです。

## Server Actions の実践的なアドバイス

実際のプロジェクトでは、いくつかの実践的なポイントがあります：

```tsx
// 1. zod で入力検証を行う。フロントエンドを信頼しない
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

// 2. Server Actions はフォームだけでなく、どこからでも呼び出せる
// ボタンクリック、定期タスク、イベントトリガーなどに適用
export async function revalidateAll() {
  revalidateTag('posts')
  revalidateTag('users')
}
```

## まとめ

- Server Actions は `"use server"` で宣言し、フォームの `action` 属性に直接バインドできるため、APIルートの記述が不要になります
- `useFormState` でフォームの状態とエラーフィードバックを処理し、プログレッシブエンハンスメントをサポート
- `useOptimistic` を Server Actions と組み合わせて楽観的更新を実現し、従来の loading 方式よりユーザー体験が向上
- サーバーサイドで入力検証を行う必要があり（zod推奨）、クライアントから送られたデータを信頼してはいけません
- Server Actions は現在、フォーム送信や単純なCRUDシナリオに適しており、複雑なリアルタイムインタラクションには引き続き API Routes が必要です