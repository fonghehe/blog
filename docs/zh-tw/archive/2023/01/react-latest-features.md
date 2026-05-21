---
title: "React 最新特性全景回顧"
date: 2023-01-17 16:44:24
tags:
  - React
readingTime: 3
description: "React 18 釋出以來，官方團隊密集推進了一系列特性：Server Components、Suspense、Transitions、use 鉤子等。這些特性不是孤立的，它們共同構成了 React 的新架構藍圖。本文從實際開發角度梳理這些特性的現狀和最佳實踐。"
wordCount: 440
---

React 18 釋出以來，官方團隊密集推進了一系列特性：Server Components、Suspense、Transitions、use 鉤子等。這些特性不是孤立的，它們共同構成了 React 的新架構藍圖。本文從實際開發角度梳理這些特性的現狀和最佳實踐。

## Transitions：區分緊急與非緊急更新

`useTransition` 和 `startTransition` 讓 React 知道哪些更新可以被中斷。典型場景：輸入框即時過濾大量資料。

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'

export function SearchableList({ items }: { items: string[] }) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  // 輸入框更新是緊急的
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value) // 緊急更新，立即響應

    // 列表過濾是非緊急的，可以被中斷
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
      <input value={query} onChange={handleChange} placeholder="搜尋..." />
      {/* 過渡中顯示載入態 */}
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {filtered.map(item => <div key={item}>{item}</div>)}
      </div>
    </div>
  )
}
```

核心區別：沒有 `useTransition`，輸入框會等過濾完成才更新，導致卡頓。有了它，輸入框立即響應，列表過濾在後臺進行。

## Suspense：不僅僅是載入態

React 18 的 `Suspense` 配合 Server Components 和 lazy loading，是一個統一的非同步邊界。

```tsx
import { Suspense } from 'react'

// 場景一：資料獲取（配合 Server Components 或 use() 鉤子）
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)
  return <div>{user.name}</div>
}

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        {/* UserProfile 是非同步 Server Component */}
        <UserProfile userId="123" />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity userId="123" />
      </Suspense>
    </div>
  )
}

// 場景二：程式碼分割
const HeavyChart = React.lazy(() => import('@/components/HeavyChart'))

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  )
}
```

`Suspense` 的關鍵是"瀑布流"載入——多個 Suspense 邊界獨立工作，先到先渲染，而不是等所有資料都就緒。

## use() 鉤子：讀取 Promise 和 Context

React 18.x 實驗性 API 中的 `use()` 鉤子，可以在條件語句和迴圈中讀取 Promise 和 Context，這是 `useContext` 和 `await` 做不到的。

```tsx
import { use } from 'react'

// 讀取 Promise
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

// 條件讀取 Context — useContext 不能放在 if 裡，use() 可以
function ConditionalTheme({ showThemed }: { showThemed: boolean }) {
  if (showThemed) {
    const theme = use(ThemeContext) // 在條件語句中使用
    return <div style={{ color: theme.primary }}>Themed content</div>
  }
  return <div>Default content</div>
}
```

## 自動批次更新

React 18 將批次更新從 React 事件處理器擴充套件到了所有上下文，包括 `setTimeout`、`Promise` 回撥、原生事件。

```tsx
function App() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  function handleClick() {
    // React 18 以前：兩次渲染
    // React 18：一次批次渲染
    setTimeout(() => {
      setCount(c => c + 1)
      setFlag(f => !f)
      // 兩次 setState 合併為一次渲染
    }, 100)
  }

  // 如果確實需要每次 setState 立即渲染，用 flushSync
  import { flushSync } from 'react-dom'

  function handleForceRender() {
    flushSync(() => setCount(c => c + 1))
    // 此時 DOM 已經更新
    flushSync(() => setFlag(f => !f))
  }

  return <button onClick={handleClick}>Count: {count}</button>
}
```

## 小結

- `useTransition` 區分緊急和非緊急更新，搜尋過濾是最典型的用例
- `Suspense` 是統一的非同步邊界，支援資料獲取和程式碼分割，配合流式渲染效果最佳
- `use()` 鉤子可以在條件語句中讀取 Promise 和 Context，比 `useContext` 更靈活
- React 18 自動批次更新覆蓋了所有非同步場景，`flushSync` 是 escape hatch
- 這些特性不是獨立的，它們共同服務於 RSC + Suspense 的新架構