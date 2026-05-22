---
title: "React 18 useTransition：讓渲染不再阻塞使用者互動"
date: 2021-05-17 11:13:52
tags:
  - React
  - JavaScript
readingTime: 2
description: "React 18 在 2021 年進入 Beta 階段，Concurrent 模式的核心 API 逐步穩定。`useTransition` 是其中最值得提前瞭解的 Hook——它解決了一個長期困擾 React 開發者的問題：大列表渲染導致的介面卡頓。"
wordCount: 451
---

React 18 在 2021 年進入 Beta 階段，Concurrent 模式的核心 API 逐步穩定。`useTransition` 是其中最值得提前瞭解的 Hook——它解決了一個長期困擾 React 開發者的問題：大列表渲染導致的介面卡頓。

## 問題背景

假設你有一個搜尋元件，使用者輸入後過濾一個上萬條資料的列表：

```jsx
function SearchableList({ items }) {
  const [query, setQuery] = useState('')
  const [filteredList, setFilteredList] = useState(items)

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value)
    // 同步過濾，萬級資料量時明顯示卡頓
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

當資料量大時，每次按鍵都會觸發一次重量級的渲染，輸入框會明顯示卡頓。

## useTransition 的解決方案

```jsx
import { useState, useTransition } from 'react'

function SearchableList({ items }) {
  const [query, setQuery] = useState('')
  const [filteredList, setFilteredList] = useState(items)
  const [isPending, startTransition] = useTransition()

  const handleChange = (e) => {
    const value = e.target.value
    // 高優先順序：立即更新輸入框
    setQuery(value)
    // 低優先順序：標記為 transition，不阻塞輸入
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

核心思路是把狀態更新分成兩個優先順序：
- `setQuery` 是緊急更新，立即執行，保證輸入框響應
- `startTransition` 包裹的更新是過渡更新，可以被中斷，不阻塞使用者互動

## 和防抖的區別

很多人第一反應是"這不就是防抖嗎"，但本質不同：

```
防抖：延遲執行，使用者停止輸入後才觸發過濾
useTransition：立即執行但可中斷，保證緊急更新優先
```

防抖犧牲了即時性，`useTransition` 保持了即時性的同時不阻塞互動。

## 配合 Suspense 使用

在 React 18 中，`useTransition` 和 `Suspense` 配合效果更好：

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

當用戶快速切換使用者時，舊內容會保持顯示，直到新內容載入完成，避免了白屏閃爍。

## 注意事項

1. `startTransition` 回撥裡的更新必須是同步的，不能包裹非同步操作
2. Transition 不能用於受控輸入框的值更新
3. 目前 `useTransition` 隻在 Concurrent 模式下生效，Legacy 模式下會退化為同步更新

## 小結

- `useTransition` 是 React 18 Concurrent 模式的核心 API
- 它區分了緊急更新和過渡更新，讓渲染可被中斷
- 解決了大列表過濾、Tab 切換等場景的卡頓問題
- 和防抖不同，不犧牲即時性
- 建議在 React 18 Beta 期間就開始學習和試驗