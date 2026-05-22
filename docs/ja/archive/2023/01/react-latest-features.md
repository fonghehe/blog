---
title: "React 最新機能 全景レビュー"
date: 2023-01-17 16:44:24
tags:
  - React
readingTime: 4
description: "React 18 のリリース以降、公式チームは Server Components、Suspense、Transitions、use フックなど、一連の機能を集中的に推進してきました。これらの機能は独立したものではなく、React の新しいアーキテクチャの青写真を構成しています。本記事では、実際の開発の視点からこれらの機能の現状とベストプラクティスを整理します。"
wordCount: 793
---

React 18 がリリースされて以来、公式チームは Server Components、Suspense、Transitions、use フックなどの一連の機能を集中的に推進してきました。これらの機能は独立したものではなく、React の新しいアーキテクチャの青写真を構成しています。本記事では、実際の開発の視点からこれらの機能の現状とベストプラクティスを整理します。

## Transitions：緊急・非緊急更新の区別

`useTransition` と `startTransition` を使用すると、React はどの更新が中断可能かを認識できます。典型的なユースケースは、入力ボックスでのリアルタイム大規模データフィルタリングです。

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'

export function SearchableList({ items }: { items: string[] }) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  // 入力欄の更新は緊急です
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value) // 緊急更新、即座に反映

    // リストフィルタリングは非緊急で、中断可能です
    startTransition(() => {
      setFilteredQuery(e.target.value)
    })
  }

  const [filteredQuery, setFilteredQuery] = useState('')

  const filtered = useMemo(
    () => items.filter(item => item.toLowerCase().includes(filteredQuery.toLowerCase())),
    [items, filteredQuery]
  )

  return (
    <div>
      <input value={query} onChange={handleChange} placeholder="検索..." />
      {/* 遷移中はローディング状態を表示 */}
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {filtered.map(item => <div key={item}>{item}</div>)}
      </div>
    </div>
  )
}
```

最大の違いは、`useTransition` がない場合、入力ボックスはフィルタリングが完了するまで更新されず、カクつきが発生することです。`useTransition` を使用すると、入力ボックスは即座に応答し、リストフィルタリングはバックグラウンドで実行されます。

## Suspense：ローディング状態だけではない

React 18 の `Suspense` は、Server Components や lazy loading と組み合わせることで、統一された非同期境界として機能します。

```tsx
import { Suspense } from 'react'

// シナリオ1：データ取得（Server Components または use() フックと組み合わせ）
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)
  return <div>{user.name}</div>
}

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        {/* UserProfile は非同期 Server Component */}
        <UserProfile userId="123" />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity userId="123" />
      </Suspense>
    </div>
  )
}

// シナリオ2：コード分割
const HeavyChart = React.lazy(() => import('@/components/HeavyChart'))

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  )
}
```

`Suspense` の鍵は「ウォーターフォール」ローディングです。複数の Suspense 境界が独立して動作し、先に準備ができたものからレンダリングされます。すべてのデータが揃うのを待つ必要はありません。

## use() フック：Promise と Context の読み取り

React 18.x の実験的 API である `use()` フックは、条件文やループ内で Promise や Context を読み取ることができます。これは `useContext` や `await` では実現できません。

```tsx
import { use } from 'react'

// Promise の読み取り
async function Comments({ commentsPromise }: {
  commentsPromise: Promise<Comment[]>
}) {
  const comments = use(commentsPromise)

  return (
    <ul>
      {comments.map(c => <li key={c.id}>{c.text}</li>)}
    </ul>
  )
}

// 条件による Context の読み取り — useContext は if の中で使えないが、use() は使える
function ConditionalTheme({ showThemed }: { showThemed: boolean }) {
  if (showThemed) {
    const theme = use(ThemeContext) // 条件文で使用
    return <div style={{ color: theme.primary }}>Themed content</div>
  }
  return <div>Default content</div>
}
```

## 自動バッチ処理

React 18 はバッチ更新を React イベントハンドラからすべてのコンテキストに拡張しました。`setTimeout`、`Promise` コールバック、ネイティブイベントも含まれます。

```tsx
function App() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  function handleClick() {
    // React 18 以前：2回レンダリング
    // React 18：1回のバッチレンダリング
    setTimeout(() => {
      setCount(c => c + 1)
      setFlag(f => !f)
      // 2回の setState が1回のレンダリングに統合される
    }, 100)
  }

  // 各 setState を即座にレンダリングする必要がある場合は flushSync を使用
  import { flushSync } from 'react-dom'

  function handleForceRender() {
    flushSync(() => setCount(c => c + 1))
    // この時点で DOM は更新済み
    flushSync(() => setFlag(f => !f))
  }

  return <button onClick={handleClick}>Count: {count}</button>
}
```

## まとめ

- `useTransition` は緊急更新と非緊急更新を区別し、検索フィルタリングが最も典型的なユースケースです
- `Suspense` は統一された非同期境界であり、データ取得とコード分割をサポートし、ストリーミングレンダリングと組み合わせると最も効果的です
- `use()` フックは条件文で Promise と Context を読み取ることができ、`useContext` よりも柔軟です
- React 18 の自動バッチ更新はすべての非同期シナリオをカバーし、`flushSync` はエスケープハッチです
- これらの機能は独立したものではなく、RSC + Suspense の新しいアーキテクチャに共同で貢献しています
