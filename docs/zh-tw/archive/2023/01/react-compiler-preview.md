---
title: "React Compiler 預覽與原理"
date: 2023-01-19 11:47:06
tags:
  - React
readingTime: 3
description: "React Compiler（原 React Forget）是 React 團隊正在開發的編譯時最佳化工具。它的目標是自動處理 `useMemo`、`useCallback`、`React.memo` 的插入，讓開發者不再需要手動管理這些效能最佳化。本文基於公開資訊分析其工作原理和對現有程式碼的影響。"
---

React Compiler（原 React Forget）是 React 團隊正在開發的編譯時最佳化工具。它的目標是自動處理 `useMemo`、`useCallback`、`React.memo` 的插入，讓開發者不再需要手動管理這些效能最佳化。本文基於公開資訊分析其工作原理和對現有程式碼的影響。

## 現狀：手動最佳化的痛點

在 React 18 中，效能最佳化完全依賴開發者手動處理。程式碼充斥著大量樣板：

```tsx
// 沒有最佳化時，每次父元件渲染都會重新建立函式和物件
function Parent() {
  const [count, setCount] = useState(0)

  // 每次渲染都是新的引用
  const handleClick = () => console.log('clicked')
  const config = { step: 1 }

  return <Child onClick={handleClick} config={config} />
}

// 手動最佳化後
function Parent() {
  const [count, setCount] = useState(0)

  const handleClick = useCallback(() => console.log('clicked'), [])
  const config = useMemo(() => ({ step: 1 }), [])

  return <Child onClick={handleClick} config={config} />
}

const Child = memo(function Child({ onClick, config }: Props) {
  // 只有當 onClick 或 config 的引用變化時才重新渲染
  return <div onClick={onClick}>Step: {config.step}</div>
})
```

這種最佳化模式有兩個問題：一是容易遺漏（該 memo 的沒 memo），二是容易過度 memo（不需要 memo 的也 memo 了），兩種情況都會降低效能。

## Compiler 的工作原理

React Compiler 是一個 Babel 外掛，在編譯階段分析元件程式碼的依賴關係，自動插入等效的 memoization 邏輯。

```tsx
// 開發者寫的程式碼
function TodoList({ items, filter }: { items: Todo[], filter: string }) {
  const filtered = items.filter(item => item.text.includes(filter))
  const count = filtered.length

  return (
    <div>
      <p>共 {count} 條</p>
      {filtered.map(item => (
        <TodoItem key={item.id} item={item} />
      ))}
    </div>
  )
}

// Compiler 自動轉換後的等效邏輯（概念性虛擬碼）
function TodoList({ items, filter }: Props) {
  // 自動為派生資料新增 memo
  const filtered = useMemo(
    () => items.filter(item => item.text.includes(filter)),
    [items, filter]
  )
  const count = useMemo(() => filtered.length, [filtered])

  // 自動為元件引用新增穩定化
  return React.createElement('div', null,
    React.createElement('p', null, '共 ', count, ' 條'),
    filtered.map(item =>
      React.createElement(TodoItem, { key: item.id, item })
    )
  )
}
```

Compiler 不會改變元件的行為，只最佳化不必要的重新計算和重新渲染。從 React Conf 2023 的 demo 來看，它能識別出 props 是否穩定、派生值是否需要快取、事件處理器是否需要穩定引用。

## 對現有程式碼的影響

React Compiler 的目標是相容現有程式碼。如果程式碼已經手動做了 `useMemo`/`useCallback`，Compiler 會識別並跳過，不會重複插入。

```tsx
// 已有手動 memo 的程式碼，Compiler 不會重複處理
function Example() {
  const value = useMemo(() => expensiveCalc(), [dep])
  const handler = useCallback(() => doSomething(), [])
  // Compiler 看到已經 memo 了，跳過
  return <Child value={value} onAction={handler} />
}

// 但有些模式 Compiler 無法最佳化
function BadExample() {
  // 可變的 ref 操作，Compiler 無法安全推斷
  const ref = useRef(null)
  useEffect(() => {
    ref.current = document.getElementById('target')
  }, [])

  // 隱式的副作用，Compiler 可能無法識別
  const data = globalStore.getData() // 外部可變狀態
  return <div>{data}</div>
}
```

Compiler 要求程式碼遵循 React 的規則：不修改 props、不在渲染時執行副作用、依賴不可變資料。這正是 `eslint-plugin-react-hooks` 的 `exhaustive-deps` 和 `hooks/rules` 一直在強調的。

## 編譯時最佳化 vs 執行時最佳化

React Compiler 代表了 React 從純執行時框架向編譯時輔助框架的轉變。

```tsx
// 執行時最佳化（當前方案）
// 依賴開發者手動插入，執行時執行比較
const Child = memo(function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
})

// 編譯時最佳化（Compiler 方案）
// 編譯器自動分析：items 是 props，如果沒有變化就不需要重新執行
function Child({ items }) {
  return items.map(item => <div key={item.id}>{item.name}</div>)
}
// 編譯後自動包裹了 memo 邏輯，無需開發者干預
```

這與 Svelte、SolidJS 等框架的思路一致：在編譯階段做盡可能多的分析，減少執行時的工作量。但 React 不會像 Svelte 那樣完全編譯掉虛擬 DOM，因為 RSC 和 Server Components 需要執行時的序列化能力。

## 小結

- React Compiler 自動插入 `useMemo`/`useCallback`/`memo`，目標是讓開發者不再手動做這些最佳化
- 編譯器要求程式碼遵循 React 規則（不可變性、無副作用渲染），eslint 規則的嚴格執行是 Compiler 相容的前提
- 已有手動最佳化的程式碼不會被 Compiler 干擾，它會跳過已經 memo 的部分
- Compiler 代表 React 向編譯時最佳化的轉變，但不會完全拋棄虛擬 DOM 執行時
- 目前 Compiler 仍在開發中，建議在新專案中養成遵循 React 規則的習慣