---
title: "React 18 自動バッチ処理と Transition"
date: 2021-04-19 11:47:10
tags:
  - React
  - JavaScript

readingTime: 4
description: "React 18 Alpha がリリースされ、Concurrent Mode が実験的な概念から実際に使える機能として本格的に導入されました。最も注目すべき2つの機能は、自動バッチ処理（Automatic Batching）と useTransition です。"
wordCount: 729
---

React 18 Alpha がリリースされ、Concurrent Mode の実践的な導入が実現しました——もはや実験的な概念ではなく、実際に活用できる機能です。最も注目すべき2つの機能は、自動バッチ処理（Automatic Batching）と `useTransition` です。

## 自動バッチ処理

React 17 以前では、React のイベントハンドラ内での複数回の `setState` のみがバッチ処理されていました。`setTimeout`、`Promise` のコールバック、ネイティブイベント内ではバッチ処理されません：

```jsx
// React 17 —— イベントハンドラ内：バッチ処理 ✅
function handleClick() {
  setCount(c => c + 1)
  setFlag(f => !f)
  // 1回だけレンダリング
}

// React 17 —— setTimeout 内：バッチ処理されない ❌
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 2回レンダリング！
  }, 0)
}

// React 17 —— Promise 内：バッチ処理されない ❌
async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)     // 1回レンダリング
  setData(data)         // さらに1回レンダリング
  setTotal(data.length) // さらに1回レンダリング
}
```

React 18 ではすべてのシナリオで自動バッチ処理が行われます：

```jsx
// React 18 —— すべてのシナリオでバッチ処理 ✅
function handleClick() {
  setTimeout(() => {
    setCount(c => c + 1)
    setFlag(f => !f)
    // 1回だけレンダリング
  }, 0)
}

async function fetchData() {
  const data = await api.get('/users')
  setLoading(false)
  setData(data)
  setTotal(data.length)
  // 上記はすべて1回のレンダリングにまとめられる！
}
```

パフォーマンスの向上は直接的で、コードの修正も不要です。唯一の例外は、強制的に同期的に更新する必要がある場合で、そのときは `flushSync` を使用します：

```jsx
import { flushSync } from 'react-dom'

function handleClick() {
  flushSync(() => {
    setCount(c => c + 1)
  })
  // flushSync の後、DOM は既に更新されている
  // 安全に更新後の DOM を読み取れる
  inputRef.current.focus()
}
```

## useTransition

`useTransition` は React 18 の中核的な新 API であり、優先度の低い状態更新をマークするために使用します：

```jsx
import { useState, useTransition } from 'react'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  function handleSearch(e) {
    const value = e.target.value
    setQuery(value) // 高優先度：入力欄は即座に応答

    // 低優先度：検索結果は遅延可能
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

核心概念：`startTransition` 内の状態更新は「中断可能」とマークされます。ユーザーが素早く入力すると、React は古いレンダリングを破棄し、新しい入力を優先的に処理するため、入力のカクつきが発生しません。

## useDeferredValue

`useDeferredValue` は `useTransition` を補完するもので、特定の値の更新を遅延させるために使用します：

```jsx
import { useState, useDeferredValue, useMemo } from 'react'

function App() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  // query が変化すると、deferredQuery は遅延して更新される
  // 古い値のレンダリング結果をフォールバックとして表示できる
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

`Suspense` と組み合わせるとさらに効果的です：

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

## React 18 へのアップグレード

アップグレード手順は予想よりも簡単です：

```jsx
// React 17
import ReactDOM from 'react-dom'
ReactDOM.render(<App />, document.getElementById('root'))

// React 18
import { createRoot } from 'react-dom/client'
const root = createRoot(document.getElementById('root'))
root.render(<App />)
```

注意：新しい `createRoot` API を使用すると、自動バッチ処理が有効になります。API を変更しない場合はデフォルトで React 17 の動作のままなので、段階的にアップグレードできます。

## 実際のシナリオ比較

テーブルフィルタリングのシナリオを比較します：

```jsx
// useTransition なし：入力がカクつく
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

// useTransition あり：入力がスムーズ
function FilterTable() {
  const [filter, setFilter] = useState('')
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState([])

  function handleChange(e) {
    setFilter(e.target.value) // 入力欄を即座に更新
    startTransition(() => {
      setRows(expensiveFilterOperation(e.target.value)) // テーブルは遅延更新
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

## まとめ

- React 18 の自動バッチ処理はコード修正不要で、アップグレード後はすべてのシナリオでデフォルトで更新が統合される
- `useTransition` は入力のカクつきなどのパフォーマンス問題を解決し、核心は優先度の区別
- `useDeferredValue` は「空白を表示するより古いデータを表示したほうがよい」シナリオに適している
- アップグレードは `createRoot` API を使用し、段階的に移行可能
- Concurrent Mode がついに概念から実用的なツールへと変わった
