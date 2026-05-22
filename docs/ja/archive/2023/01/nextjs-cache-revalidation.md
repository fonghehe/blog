---
title: "Next.js キャッシュと再検証戦略"
date: 2023-01-13 11:13:16
tags:
  - Next.js
readingTime: 4
description: "Next.js 13/14 のキャッシュ戦略は、全フレームワークの中で最もデフォルトの動作が攻撃的です。fetch キャッシュ、revalidate、revalidatePath、revalidateTag の違いと適用シーンを理解することが、「なぜページデータが更新されないのか」といった問題を避ける鍵です。"
wordCount: 895
---

Next.js 13/14のキャッシュ戦略は、すべてのフレームワークの中で最もデフォルトの動作が攻撃的です。`fetch` キャッシュ、`revalidate`、`revalidatePath`、`revalidateTag` の違いと適用シーンを理解することが、「なぜページデータが更新されないのか」といった問題を避ける鍵です。

## キャッシュ階層の全体像

Next.jsのキャッシュは4層あり、外側から内側の順に次のとおりです：

1. **Request Memoization** — 同一リクエスト内の重複 `fetch` を自動的に排除
2. **Data Cache** — `fetch` レスポンスの永続的キャッシュ、デフォルトで永続
3. **Full Route Cache** — ページレベルの静的キャッシュ、RSC Payload + HTML を含む
4. **Router Cache** — クライアント側ルーターキャッシュ、prefetchされたページのキャッシュ

```tsx
// app/blog/page.tsx
export default async function BlogPage() {
  // この fetch は Data Cache にキャッシュされ、デフォルトで永続
  // 同一レンダリングリクエスト内で同じURLを複数回呼び出すと、Request Memoization が重複排除
  const posts = await fetch('https://api.example.com/posts')

  // この fetch は毎回再検証
  const realtime = await fetch('https://api.example.com/stock-price', {
    cache: 'no-store'
  })

  // この fetch は60秒後に期限切れ
  const trending = await fetch('https://api.example.com/trending', {
    next: { revalidate: 60 }
  })

  return <PostList posts={await posts.json()} />
}
```

## revalidatePath と revalidateTag の違い

`revalidatePath` はパスに基づいてキャッシュを無効化し、`revalidateTag` はタグに基づいて無効化します。Server Actions では、`revalidateTag` の方がより正確なため推奨されます。

```tsx
// 方式一：revalidatePath — パスに基づく
'use server'

import { revalidatePath } from 'next/cache'

export async function createPost(formData: FormData) {
  await db.post.create({ data: { ... } })
  // /blog パス以下の全ページのキャッシュを無効化
  revalidatePath('/blog')
  // 動的ルートも無効化可能
  revalidatePath('/blog/[slug]', 'page')
  // レイアウトも一緒に無効化
  revalidatePath('/blog', 'layout')
}

// 方式二：revalidateTag — タグに基づく
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
  // すべての 'posts' タグが付いたキャッシュを無効化
  revalidateTag('posts')
}
```

`revalidateTag` の利点は、どのページがこのデータを使用しているかを知る必要がないことです。データにタグが付いていれば、どのページのキャッシュも正しく無効化されます。

## オンデマンド再検証 vs 時間ベース再検証

两种策略适用不同场景：

```tsx
// 時間駆動：データは指定秒数後に期限切れ
const data = await fetch('https://api.example.com/data', {
  next: { revalidate: 3600 } // 1小时
})
// 適している：あまり頻繁に変更されないデータ（設定、カテゴリ一覧など）

// on-demand：Server Action または Route Handler で手動トリガー
'use server'
export async function publishPost(postId: string) {
  await db.post.update({
    where: { id: postId },
    data: { status: 'published' }
  })
  revalidateTag('posts')
  revalidatePath('/blog')
}
// 適している：データ変更が明確に追跡可能なビジネスシナリオ
```

私のアドバイスとしては、優先的にon-demand revalidationを使用することです。時間駆動のrevalidateは、変更のトリガーポイントが本当にないデータ（サードパーティAPIから返されるデータなど）にのみ使用してください。

## 非fetchデータソースのキャッシュ処理

データベースクエリやファイル読み取りなど、`fetch` 以外の操作は自動的にキャッシュされません。`unstable_cache` を使って手動でラップする必要があります。

```tsx
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'

// 基本的な使用法
const getCachedUser = unstable_cache(
  async (id: string) => {
    return db.user.findUnique({ where: { id } })
  },
  ['user'],       // key のプレフィックス
  { revalidate: 3600, tags: ['users'] }
)

// Server Component で使用
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

// Server Action で無効化
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

## キャッシュデバッグのテクニック

開発環境では `next.config.js` でログを有効にして、キャッシュの動作を観察できます：

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

コンソールに各 `fetch` のキャッシュヒット状況が出力されます。本番環境では `x-next-cache-tags` と `x-next-cache-status` レスポンスヘッダーを使ってデバッグできます。

## まとめ

- Next.js のデフォルトのキャッシュ動作は非常に積極的で、`fetch` はデフォルトで永久キャッシュされるため、理解した上で戦略を選択する必要があります
- 優先的に `revalidateTag` + on-demand revalidation を使用し、時間駆動よりも正確で制御しやすいです
- 非 fetch データソース（データベースなど）は `unstable_cache` でラップしないと、キャッシュされず自動無効化もされません
- 開発時は `logging.fetches` 設定でキャッシュヒット状況を観察し、キャッシュ関連の不具合を回避しましょう
- `revalidatePath` と `revalidateTag` は異なる次元の無効化メカニズムなので、シナリオに応じて選択してください