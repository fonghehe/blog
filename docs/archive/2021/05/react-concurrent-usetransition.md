---
title: "React 18 useTransition：让渲染不再阻塞用户交互"
date: 2021-05-17 11:13:52
tags:
  - React
  - JavaScript
readingTime: 2
description: "React 18 在 2021 年进入 Beta 阶段，Concurrent 模式的核心 API 逐步稳定。`useTransition` 是其中最值得提前了解的 Hook——它解决了一个长期困扰 React 开发者的问题：大列表渲染导致的界面卡顿。"
wordCount: 445
---

React 18 在 2021 年进入 Beta 阶段，Concurrent 模式的核心 API 逐步稳定。`useTransition` 是其中最值得提前了解的 Hook——它解决了一个长期困扰 React 开发者的问题：大列表渲染导致的界面卡顿。

## 问题背景

假设你有一个搜索组件，用户输入后过滤一个上万条数据的列表：

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

当数据量大时，每次按键都会触发一次重量级的渲染，输入框会明显卡顿。

## useTransition 的解决方案

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

核心思路是把状态更新分成两个优先级：
- `setQuery` 是紧急更新，立即执行，保证输入框响应
- `startTransition` 包裹的更新是过渡更新，可以被中断，不阻塞用户交互

## 和防抖的区别

很多人第一反应是"这不就是防抖吗"，但本质不同：

```
防抖：延迟执行，用户停止输入后才触发过滤
useTransition：立即执行但可中断，保证紧急更新优先
```

防抖牺牲了实时性，`useTransition` 保持了实时性的同时不阻塞交互。

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

当用户快速切换用户时，旧内容会保持显示，直到新内容加载完成，避免了白屏闪烁。

## 注意事项

1. `startTransition` 回调里的更新必须是同步的，不能包裹异步操作
2. Transition 不能用于受控输入框的值更新
3. 目前 `useTransition` 只在 Concurrent 模式下生效，Legacy 模式下会退化为同步更新

## 小结

- `useTransition` 是 React 18 Concurrent 模式的核心 API
- 它区分了紧急更新和过渡更新，让渲染可被中断
- 解决了大列表过滤、Tab 切换等场景的卡顿问题
- 和防抖不同，不牺牲实时性
- 建议在 React 18 Beta 期间就开始学习和试验