---
title: "React 18 自動批處理與 Transition"
date: 2021-04-19 11:47:10
tags:
  - React
  - JavaScript
readingTime: 3
description: "React 18 Alpha 已經發布，帶來了 Concurrent Mode 的實際落地——不再是實驗性的概念，而是可以真正用起來的能力。兩個最值得關注的特性是自動批處理（Automatic Batching）和 `useTransition`。"
---

React 18 Alpha 已經發布，帶來了 Concurrent Mode 的實際落地——不再是實驗性的概念，而是可以真正用起來的能力。兩個最值得關注的特性是自動批處理（Automatic Batching）和 `useTransition`。

## 自動批處理

React 17 及之前，只有 React 事件處理器中的多次 `setState` 會被批處理。在 `setTimeout`、`Promise` 回調、原生事件中則不會：

```jsx
// React 17 —— 事件處理器中：批處理 ✅
function handleClick() {
  setCount(c => c + 1)
  setFlag(f => !f)
  // 只觸發一次渲染
}

// React 17 —— setTimeout 中：不批處理 ❌
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 觸發兩次渲染！
  }, 0)
}

// React 17 —— Promise 中：不批處理 ❌
async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)     // 渲染一次
  setData(data)         // 再渲染一次
  setTotal(data.length) // 再渲染一次
}
```

React 18 在所有場景下自動批處理：

```jsx
// React 18 —— 所有場景都批處理 ✅
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 只觸發一次渲染
  }, 0)
}

async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)
  setData(data)
  setTotal(data.length)
  // 以上全部只觸發一次渲染！
}
```

性能提升直接且無需改代碼。唯一的例外是你需要強制同步更新，用 `flushSync`：

```jsx
import { flushSync } from 'react-dom'

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1)
  })
  // flushSync 之後，DOM 已經更新
  // 可以安全地讀取更新後的 DOM
  inputRef.current.focus()
}
```

## useTransition

`useTransition` 是 React 18 的核心新 API，用於標記低優先級的狀態更新：

```jsx
import { useState, useTransition } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function handleSearch(e) {
    const value = e.target.value
    setQuery(value) // 高優先級：輸入框立即響應

    // 低優先級：搜索結果可以延遲
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

核心概念：`startTransition` 內的狀態更新會被標記為"可以被打斷"。如果用户快速輸入，React 會丟棄舊的渲染，優先響應新的輸入——不會出現輸入卡頓的情況。

## useDeferredValue

`useDeferredValue` 是 `useTransition` 的補充，用於延遲某個值的更新：

```jsx
import { useState, useDeferredValue, useMemo } from 'react'

function App() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  // 當 query 變化時，deferredQuery 會延遲更新
  // 舊值的渲染結果可以作為 fallback 顯示
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

## 升級到 React 18

升級步驟比預想的簡單：

```jsx
// React 17
import ReactDOM from 'react-dom'
ReactDOM.render(<App />, document.getElementById('root'))

// React 18
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

注意：用了新的 `createRoot` API 後，自動批處理就生效了。不改 API 的話默認還是 React 17 行為，可以漸進升級。

## 實際場景對比

一個表格篩選場景的對比：

```jsx
// 沒有 useTransition：輸入框卡頓
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

// 有 useTransition：輸入流暢
function FilterTable() {
  const [filter, setFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState([])

  function handleChange(e) {
    setFilter(e.target.value) // 立即更新輸入框
    startTransition(() => {
      setRows(expensiveFilterOperation(e.target.value)) // 延遲更新表格
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

## 小結

- React 18 自動批處理無需改代碼，升級後所有場景默認合併更新
- `useTransition` 解決了輸入卡頓等性能問題，核心思路是區分優先級
- `useDeferredValue` 適合"顯示舊數據比顯示空白好"的場景
- 升級用 `createRoot` API，可漸進式遷移
- Concurrent Mode 終於不再是概念，而是實用工具