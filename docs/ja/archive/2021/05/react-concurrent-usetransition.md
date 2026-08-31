---
title: "React 18 useTransition：ノンブロッキングレンダリング"
date: 2021-05-17 11:13:52
tags:
  - React
  - JavaScript

readingTime: 3
description: "React 18 在 2021 年进入 Beta 阶段，Concurrent 模式的核心 API 逐步稳定。`useTransition` 是其中最值得提前了解的 Hook——它解决了一个长期困扰 React 开发者的问题：大列表渲染导致的界面卡顿。"
wordCount: 703
---

React 18 は 2021 年に Beta 段階に入り、Concurrent モードの中核となる API が徐々に安定してきた。`useTransition` は事前に知っておく価値がある Hook の一つだ。これは React 開発者を長年悩ませてきた問題、つまり大量のリストを描画する際の UI のカクつきを解決する。

## 問題の背景

検索コンポーネントがあり、ユーザーが入力すると数万件のデータを含むリストを絞り込むと仮定しよう：

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

データ量が多い場合、キー入力のたびに負荷の大きい描画が発生し、入力欄が明らかにカクつく。

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

本質的な考え方は、状態更新を 2 つの優先度に分けることだ：
- `setQuery` は緊急更新で、即座に実行され、入力欄の応答性を保証する
- `startTransition` で囲んだ更新はトランジション更新となり、中断可能でユーザーの操作をブロックしない

## デバウンスとの違い

多くの人は最初「これはただのデバウンスだろう」と思うが、本質は異なる：

```
防抖：延迟执行，用户停止输入后才触发过滤
useTransition：立即执行但可中断，保证紧急更新优先
```

デバウンスはリアルタイム性を犠牲にするが、`useTransition` はリアルタイム性を保ちつつ、操作をブロックしない。

## Suspense と組み合わせて使う

React 18 では、`useTransition` と `Suspense` を組み合わせるとさらに効果的だ：

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

ユーザーが素早く切り替わると、新しいコンテンツの読み込みが終わるまで古い内容が表示されたままになり、白い画面のちらつきを防げる。

## 注意事項

1. `startTransition` のコールバック内の更新は同期でなければならず、非同期処理を囲んではいけない
2. Transition は制御された入力欄の値の更新には使えない
3. 現時点では `useTransition` は Concurrent モードでのみ有効で、Legacy モードでは同期更新に退行する

## まとめ

- `useTransition` は React 18 の Concurrent モードの中核となる API だ
- 緊急更新とトランジション更新を分け、描画を中断可能にする
- 大量リストの絞り込みやタブ切り替えなどの場面でのカクつきを解決する
- デバウンスと異なり、リアルタイム性を犠牲にしない
- React 18 Beta の段階から学び、試してみることを推奨する