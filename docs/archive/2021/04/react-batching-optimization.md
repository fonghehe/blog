---
title: "React 18 自动批处理与 Transition"
date: 2021-04-19 11:47:10
tags:
  - React
  - JavaScript
readingTime: 3
description: "React 18 Alpha 已经发布，带来了 Concurrent Mode 的实际落地——不再是实验性的概念，而是可以真正用起来的能力。两个最值得关注的特性是自动批处理（Automatic Batching）和 `useTransition`。"
---

React 18 Alpha 已经发布，带来了 Concurrent Mode 的实际落地——不再是实验性的概念，而是可以真正用起来的能力。两个最值得关注的特性是自动批处理（Automatic Batching）和 `useTransition`。

## 自动批处理

React 17 及之前，只有 React 事件处理器中的多次 `setState` 会被批处理。在 `setTimeout`、`Promise` 回调、原生事件中则不会：

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

React 18 在所有场景下自动批处理：

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

性能提升直接且无需改代码。唯一的例外是你需要强制同步更新，用 `flushSync`：

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

`useTransition` 是 React 18 的核心新 API，用于标记低优先级的状态更新：

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

核心概念：`startTransition` 内的状态更新会被标记为"可以被打断"。如果用户快速输入，React 会丢弃旧的渲染，优先响应新的输入——不会出现输入卡顿的情况。

## useDeferredValue

`useDeferredValue` 是 `useTransition` 的补充，用于延迟某个值的更新：

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

和 `Suspense` 配合使用效果更好：

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

## 升级到 React 18

升级步骤比预想的简单：

```jsx
// React 17
import ReactDOM from 'react-dom'
ReactDOM.render(<App />, document.getElementById('root'))

// React 18
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

注意：用了新的 `createRoot` API 后，自动批处理就生效了。不改 API 的话默认还是 React 17 行为，可以渐进升级。

## 实际场景对比

一个表格筛选场景的对比：

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

## 小结

- React 18 自动批处理无需改代码，升级后所有场景默认合并更新
- `useTransition` 解决了输入卡顿等性能问题，核心思路是区分优先级
- `useDeferredValue` 适合"显示旧数据比显示空白好"的场景
- 升级用 `createRoot` API，可渐进式迁移
- Concurrent Mode 终于不再是概念，而是实用工具