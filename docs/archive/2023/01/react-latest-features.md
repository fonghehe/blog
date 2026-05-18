---
title: "React 最新特性全景回顾"
date: 2023-01-17 16:44:24
tags:
  - React
readingTime: 3
description: "React 18 发布以来，官方团队密集推进了一系列特性：Server Components、Suspense、Transitions、use 钩子等。这些特性不是孤立的，它们共同构成了 React 的新架构蓝图。本文从实际开发角度梳理这些特性的现状和最佳实践。"
---

React 18 发布以来，官方团队密集推进了一系列特性：Server Components、Suspense、Transitions、use 钩子等。这些特性不是孤立的，它们共同构成了 React 的新架构蓝图。本文从实际开发角度梳理这些特性的现状和最佳实践。

## Transitions：区分紧急与非紧急更新

`useTransition` 和 `startTransition` 让 React 知道哪些更新可以被中断。典型场景：输入框实时过滤大量数据。

```tsx
'use client'

import { useState, useTransition, useMemo } from 'react'

export function SearchableList({ items }: { items: string[] }) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  // 输入框更新是紧急的
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value) // 紧急更新，立即响应

    // 列表过滤是非紧急的，可以被中断
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
      <input value={query} onChange={handleChange} placeholder="搜索..." />
      {/* 过渡中显示加载态 */}
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        {filtered.map(item => <div key={item}>{item}</div>)}
      </div>
    </div>
  )
}
```

核心区别：没有 `useTransition`，输入框会等过滤完成才更新，导致卡顿。有了它，输入框立即响应，列表过滤在后台进行。

## Suspense：不仅仅是加载态

React 18 的 `Suspense` 配合 Server Components 和 lazy loading，是一个统一的异步边界。

```tsx
import { Suspense } from 'react'

// 场景一：数据获取（配合 Server Components 或 use() 钩子）
async function UserProfile({ userId }: { userId: string }) {
  const user = await fetchUser(userId)
  return <div>{user.name}</div>
}

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        {/* UserProfile 是异步 Server Component */}
        <UserProfile userId="123" />
      </Suspense>

      <Suspense fallback={<ActivitySkeleton />}>
        <RecentActivity userId="123" />
      </Suspense>
    </div>
  )
}

// 场景二：代码分割
const HeavyChart = React.lazy(() => import('@/components/HeavyChart'))

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  )
}
```

`Suspense` 的关键是"瀑布流"加载——多个 Suspense 边界独立工作，先到先渲染，而不是等所有数据都就绪。

## use() 钩子：读取 Promise 和 Context

React 18.x 实验性 API 中的 `use()` 钩子，可以在条件语句和循环中读取 Promise 和 Context，这是 `useContext` 和 `await` 做不到的。

```tsx
import { use } from 'react'

// 读取 Promise
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

// 条件读取 Context — useContext 不能放在 if 里，use() 可以
function ConditionalTheme({ showThemed }: { showThemed: boolean }) {
  if (showThemed) {
    const theme = use(ThemeContext) // 在条件语句中使用
    return <div style={{ color: theme.primary }}>Themed content</div>
  }
  return <div>Default content</div>
}
```

## 自动批量更新

React 18 将批量更新从 React 事件处理器扩展到了所有上下文，包括 `setTimeout`、`Promise` 回调、原生事件。

```tsx
function App() {
  const [count, setCount] = useState(0)
  const [flag, setFlag] = useState(false)

  function handleClick() {
    // React 18 以前：两次渲染
    // React 18：一次批量渲染
    setTimeout(() => {
      setCount(c => c + 1)
      setFlag(f => !f)
      // 两次 setState 合并为一次渲染
    }, 100)
  }

  // 如果确实需要每次 setState 立即渲染，用 flushSync
  import { flushSync } from 'react-dom'

  function handleForceRender() {
    flushSync(() => setCount(c => c + 1))
    // 此时 DOM 已经更新
    flushSync(() => setFlag(f => !f))
  }

  return <button onClick={handleClick}>Count: {count}</button>
}
```

## 小结

- `useTransition` 区分紧急和非紧急更新，搜索过滤是最典型的用例
- `Suspense` 是统一的异步边界，支持数据获取和代码分割，配合流式渲染效果最佳
- `use()` 钩子可以在条件语句中读取 Promise 和 Context，比 `useContext` 更灵活
- React 18 自动批量更新覆盖了所有异步场景，`flushSync` 是 escape hatch
- 这些特性不是独立的，它们共同服务于 RSC + Suspense 的新架构