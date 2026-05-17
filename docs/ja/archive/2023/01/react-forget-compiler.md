---
title: "React Forget コンパイラー：自動最適化"
date: 2023-01-26 10:22:01
tags:
  - React
readingTime: 3
description: "React Forget 是 React Compiler 的早期名称，它代表了 React 团队对\"让开发者忘记 memoization\"这一愿景的尝试。本文从编译器原理层面分析 Forget 是如何工作的，以及它对日常开发模式的改变。"
---

React Forget 是 React Compiler 的早期名称，它代表了 React 团队对"让开发者忘记 memoization"这一愿景的尝试。本文从编译器原理层面分析 Forget 是如何工作的，以及它对日常开发模式的改变。

## 問題の本質：参照の安定性

React 的性能问题归根结底是引用稳定性问题。组件重新渲染时，对象字面量、数组字面量、箭头函数每次都是新的引用，导致下游组件的浅比较失败。

```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {/* 这三个 props 每次渲染都是新引用 */}
      <Child
        style={{ color: 'red' }}              // 新对象
        items={[1, 2, 3]}                      // 新数组
        onSelect={(id) => console.log(id)}    // 新函数
      />
    </div>
  )
}

const Child = memo(function Child({ style, items, onSelect }: Props) {
  // 浅比较：style、items、onSelect 每次都是新引用
  // memo 完全无效，Child 每次都重新渲染
  console.log('Child rendered')
  return <div style={style}>...</div>
})
```

开发者需要手动将这些值用 `useMemo`/`useCallback` 包裹。但在实际项目中，几百个组件里手动判断哪些需要 memo 是不可能的任务。

## Forget の分析モデル

Forget 的工作方式类似 Svelte 的编译器，但分析粒度更细。它会为每个表达式建立依赖图，在依赖不变时复用之前的计算结果。

```tsx
// 开发者写的代码
function ProductCard({ product, onAddToCart }: Props) {
  const discountedPrice = product.price * (1 - product.discount)
  const formatted = `$${discountedPrice.toFixed(2)}`
  const tagColor = product.inStock ? 'green' : 'gray'

  return (
    <div>
      <h3>{product.name}</h3>
      <span style={{ color: tagColor }}>{formatted}</span>
      <button onClick={() => onAddToCart(product.id)}>加入购物车</button>
    </div>
  )
}

// Forget 编译后的概念性等价代码
function ProductCard({ product, onAddToCart }: Props) {
  // Forget 识别：discountedPrice 依赖 product.price 和 product.discount
  const discountedPrice = useMemo(
    () => product.price * (1 - product.discount),
    [product.price, product.discount]
  )

  // formatted 依赖 discountedPrice
  const formatted = useMemo(
    () => `$${discountedPrice.toFixed(2)}`,
    [discountedPrice]
  )

  // tagColor 依赖 product.inStock
  const tagColor = useMemo(
    () => product.inStock ? 'green' : 'gray',
    [product.inStock]
  )

  // style 对象只有在 tagColor 变化时才重新创建
  const style = useMemo(() => ({ color: tagColor }), [tagColor])

  // 事件处理器：只有在 onAddToCart 和 product.id 变化时才重新创建
  const handleClick = useCallback(
    () => onAddToCart(product.id),
    [onAddToCart, product.id]
  )

  return (
    <div>
      <h3>{product.name}</h3>
      <span style={style}>{formatted}</span>
      <button onClick={handleClick}>加入购物车</button>
    </div>
  )
}
```

关键是 Forget 不是粗粒度地对整个 props 对象做 memo，而是对每个独立的值做细粒度追踪。这比手动 memo 更精确。

## ミュータブルデータの処理

Forget 最难的部分是处理可变数据。React 的规则要求 props 和 state 是不可变的，Forget 依赖这一假设进行分析。

```tsx
// ❌ Forget 无法安全优化的模式
function BadExample() {
  const [items, setItems] = useState([1, 2, 3])

  // 直接修改数组 — Forget 无法追踪这种变化
  items.push(4)
  setItems(items)

  // 修改对象属性
  const config = { count: 0 }
  config.count++ // 可变操作

  return <Child items={items} config={config} />
}

// ✅ Forget 可以安全优化的模式
function GoodExample() {
  const [items, setItems] = useState([1, 2, 3])

  // 不可变更新
  setItems([...items, 4])

  // 创建新对象
  const config = { count: 0 }
  const updatedConfig = { ...config, count: config.count + 1 }

  return <Child items={items} config={updatedConfig} />
}
```

这就是为什么 React 团队一直强调不可变性的重要性。它不仅是约定，更是 Compiler 能否正确工作的前提。

## 開発者のメンタルモデルの変化

如果 Forget 成熟，开发者的心智模型会发生转变：从"我需要考虑性能"到"我只需要写正确的 React 代码"。

```tsx
// 以前：需要考虑哪些值需要 memo
function FilteredList({ items, query }: Props) {
  // "这个 filtered 需要 useMemo 吗？items 频繁变化的话需要"
  const filtered = useMemo(
    () => items.filter(item => item.name.includes(query)),
    [items, query]
  )

  // "这个 handler 需要 useCallback 吗？子组件是 memo 的话需要"
  const handleSelect = useCallback((id: string) => {
    console.log('selected', id)
  }, [])

  return (
    <List items={filtered} onSelect={handleSelect} />
  )
}

// Forget 时代：只需关注逻辑正确性
function FilteredList({ items, query }: Props) {
  // Forget 自动分析依赖，自动插入 memo
  const filtered = items.filter(item => item.name.includes(query))

  const handleSelect = (id: string) => {
    console.log('selected', id)
  }

  return (
    <List items={filtered} onSelect={handleSelect} />
  )
}
```

## まとめ

- Forget 的核心是细粒度的依赖追踪，为每个表达式建立依赖图，依赖不变则复用结果
- 它依赖 React 的不可变性规则，直接修改 props/state 的代码无法被安全优化
- Forget 不会改变组件行为，只优化不必要的重新计算和引用变化
- 对开发者来说，最大的改变是不需要手动判断哪些值需要 memo
- 目前仍在开发中，但养成遵循 React 不可变性规则的习惯，未来迁移成本为零