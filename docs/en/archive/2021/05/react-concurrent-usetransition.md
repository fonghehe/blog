---
title: "React 18 useTransition: Non-Blocking Rendering"
date: 2021-05-17 11:13:52
tags:
  - React
  - JavaScript

readingTime: 2
description: "React 18 entered beta in 2021, and the core Concurrent APIs are stabilizing step by step. useTransition is the hook most worth learning early — it solves a problem that has plagued React developers for years: UI jank caused by rendering large lists."
wordCount: 302
---

React 18 entered its Beta stage in 2021, and the core APIs of Concurrent Mode gradually stabilized. `useTransition` is one of the hooks most worth learning ahead of time — it solves a long-standing pain point for React developers: UI jank caused by rendering very large lists.

## Problem Background

Suppose you have a search component that filters a list of tens of thousands of items as the user types:

```jsx
function SearchableList({ items }) {
  const [query, setQuery] = useState('')
  const [filteredList, setFilteredList] = useState(items)

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value)
    // 同步过滤，万级数据量时明显卡顿
    setFilteredList(items.filter(item => item.name.includes(value)))
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      <List items={filteredList} />
    </>
  )
}
```

With a large dataset, every keystroke triggers an expensive render, and the input visibly stutters.

## The `useTransition` Solution

```jsx
import { useState, useTransition } from 'react'

function SearchableList({ items }) {
  const [query, setQuery] = useState('')
  const [filteredList, setFilteredList] = useState(items)
  const [isPending, startTransition] = useTransition()

  const handleChange = (e) => {
    const value = e.target.value
    // 高优先级：立即更新输入框
    setQuery(value)
    // 低优先级：标记为 transition，不阻塞输入
    startTransition(() => {
      setFilteredList(items.filter(item => item.name.includes(value)))
    })
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending ? <Spinner /> : null}
      <List items={filteredList} />
    </>
  )
}
```

The core idea is to split state updates into two priority levels:
- `setQuery` is an urgent update — it runs immediately so the input stays responsive
- The update wrapped in `startTransition` is a transition update — it can be interrupted and won't block user interaction

## Difference from Debounce

Many people's first reaction is "isn't this just debounce?" — but the nature is different:

```
防抖：延迟执行，用户停止输入后才触发过滤
useTransition：立即执行但可中断，保证紧急更新优先
```

Debounce sacrifices responsiveness, whereas `useTransition` stays real-time while not blocking interaction.

## Using with Suspense

In React 18, `useTransition` works even better paired with `Suspense`:

```jsx
function App() {
  const [isPending, startTransition] = useTransition()
  const [userId, setUserId] = useState(null)

  const handleSelect = (id) => {
    startTransition(() => {
      setUserId(id)
    })
  }

  return (
    <>
      <UserList onSelect={handleSelect} />
      {isPending && <Skeleton />}
      <Suspense fallback={<Loading />}>
        <UserProfile userId={userId} />
      </Suspense>
    </>
  )
}
```

When the user switches quickly between users, the old content stays on screen until the new content loads, avoiding a white-screen flash.

## Important Notes

1. The update inside a `startTransition` callback must be synchronous — you can't wrap async operations in it
2. A transition can't be used to update the value of a controlled input
3. Currently `useTransition` only takes effect in Concurrent Mode; under Legacy Mode it degrades to a synchronous update

## Summary

- `useTransition` is a core API of React 18's Concurrent Mode
- It distinguishes urgent updates from transition updates, making rendering interruptible
- It solves jank in scenarios like filtering large lists and switching tabs
- Unlike debounce, it doesn't sacrifice real-time responsiveness
- It's worth starting to learn and experiment with it during the React 18 Beta