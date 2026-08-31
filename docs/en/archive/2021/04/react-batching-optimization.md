---
title: "React 18 Automatic Batching and Transition"
date: 2021-04-19 11:47:10
tags:
  - React
  - JavaScript

readingTime: 3
description: "React 18 Alpha is out, bringing Concurrent Mode into practical use — no longer an experimental concept but something you can actually rely on. The two features most worth watching are automatic batching and useTransition."
wordCount: 275
---

React 18 Alpha has been released, bringing Concurrent Mode into real, practical use—no longer an experimental concept but something you can actually rely on. The two features most worth attention are Automatic Batching and `useTransition`.

## Automatic Batching

Before React 17, only multiple `setState` calls inside a React event handler were batched. They were not batched inside `setTimeout`, `Promise` callbacks, or native events:

```jsx
// React 17 —— 事件处理器中：批处理 ✅
function handleClick() {
  setCount(c => c + 1)
  setFlag(f => !f)
  // 只触发一次渲染
}

// React 17 —— setTimeout 中：不批处理 ❌
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 触发两次渲染！
  }, 0)
}

// React 17 —— Promise 中：不批处理 ❌
async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)     // 渲染一次
  setData(data)         // 再渲染一次
  setTotal(data.length) // 再渲染一次
}
```

React 18 batches automatically in every scenario:

```jsx
// React 18 —— 所有场景都批处理 ✅
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 只触发一次渲染
  }, 0)
}

async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)
  setData(data)
  setTotal(data.length)
  // 以上全部只触发一次渲染！
}
```

The performance win is immediate and requires no code changes. The only exception is when you need a forced synchronous update, using `flushSync`:

```jsx
import { flushSync } from 'react-dom'

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1)
  })
  // flushSync 之后，DOM 已经更新
  // 可以安全地读取更新后的 DOM
  inputRef.current.focus()
}
```

## useTransition

`useTransition` is a core new API in React 18, used to mark low-priority state updates:

```jsx
import { useState, useTransition } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function handleSearch(e) {
    const value = e.target.value
    setQuery(value) // 高优先级：输入框立即响应

    // 低优先级：搜索结果可以延迟
    startTransition(() => {
      const filtered = heavySearch(value)
      setResults(filtered)
    })
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending && <Spinner />}
      <ul>
        {results.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  )
}
```

Key idea: state updates inside `startTransition` are marked as "interruptible." If the user types quickly, React discards the old render and prioritizes the new input—so the typing never feels laggy.

## useDeferredValue

`useDeferredValue` complements `useTransition` and is used to defer updates to a particular value:

```jsx
import { useState, useDeferredValue, useMemo } from 'react'

function App() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  // 当 query 变化时，deferredQuery 会延迟更新
  // 旧值的渲染结果可以作为 fallback 显示
  const results = useMemo(
    () => expensiveFilter(deferredQuery),
    [deferredQuery]
  )

  const isStale = query !== deferredQuery

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <ResultList results={results} />
      </div>
    </div>
  )
}
```

It works even better combined with `Suspense`:

```jsx
function App() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <Suspense fallback={<Loading />}>
        <SearchResults query={deferredQuery} />
      </Suspense>
    </div>
  )
}
```

## Upgrading to React 18

The upgrade steps are simpler than you might expect:

```jsx
// React 17
import ReactDOM from 'react-dom'
ReactDOM.render(<App />, document.getElementById('root'))

// React 18
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

Note: once you adopt the new `createRoot` API, automatic batching kicks in. If you don't change the API, the default React 17 behavior remains, so you can upgrade incrementally.

## Real-World Scenario Comparison

Here's a comparison using a table-filtering scenario:

```jsx
// 没有 useTransition：输入框卡顿
function FilterTable() {
  const [filter, setFilter] = useState('')
  const rows = expensiveFilterOperation(filter)

  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      <Table rows={rows} />
    </>
  )
}

// 有 useTransition：输入流畅
function FilterTable() {
  const [filter, setFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState([])

  function handleChange(e) {
    setFilter(e.target.value) // 立即更新输入框
    startTransition(() => {
      setRows(expensiveFilterOperation(e.target.value)) // 延迟更新表格
    })
  }

  return (
    <>
      <input value={filter} onChange={handleChange} />
      <div style={{ opacity: isPending ? 0.5 : 1 }}>
        <Table rows={rows} />
      </div>
    </>
  )
}
```

## Summary

- React 18's automatic batching needs no code changes—after upgrading, updates are merged by default in every scenario.
- `useTransition` solves performance issues like input lag; the core idea is to separate priorities.
- `useDeferredValue` suits scenarios where showing stale data is better than showing nothing.
- Upgrade via the `createRoot` API for an incremental migration.
- Concurrent Mode is finally a practical tool, not just a concept.