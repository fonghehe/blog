---
title: "React Forget 編譯器自動最佳化"
date: 2023-01-26 10:22:01
tags:
  - React
readingTime: 3
description: "React Forget 是 React Compiler 的早期名稱，它代表了 React 團隊對\"讓開發者忘記 memoization\"這一願景的嘗試。本文從編譯器原理層面分析 Forget 是如何工作的，以及它對日常開發模式的改變。"
---

React Forget 是 React Compiler 的早期名稱，它代表了 React 團隊對"讓開發者忘記 memoization"這一願景的嘗試。本文從編譯器原理層面分析 Forget 是如何工作的，以及它對日常開發模式的改變。

## 問題的本質：引用穩定性

React 的效能問題歸根結底是引用穩定性問題。元件重新渲染時，物件字面量、陣列字面量、箭頭函式每次都是新的引用，導致下游元件的淺比較失敗。

```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      {/* 這三個 props 每次渲染都是新引用 */}
      <Child
        style={{ color: 'red' }}              // 新物件
        items={[1, 2, 3]}                      // 新陣列
        onSelect={(id) => console.log(id)}    // 新函式
      />
    </div>
  )
}

const Child = memo(function Child({ style, items, onSelect }: Props) {
  // 淺比較：style、items、onSelect 每次都是新引用
  // memo 完全無效，Child 每次都重新渲染
  console.log('Child rendered')
  return <div style={style}>...</div>
})
```

開發者需要手動將這些值用 `useMemo`/`useCallback` 包裹。但在實際專案中，幾百個元件裡手動判斷哪些需要 memo 是不可能的任務。

## Forget 的分析模型

Forget 的工作方式類似 Svelte 的編譯器，但分析粒度更細。它會為每個表示式建立依賴圖，在依賴不變時複用之前的計算結果。

```tsx
// 開發者寫的程式碼
function ProductCard({ product, onAddToCart }: Props) {
  const discountedPrice = product.price * (1 - product.discount)
  const formatted = `$${discountedPrice.toFixed(2)}`
  const tagColor = product.inStock ? 'green' : 'gray'

  return (
    <div>
      <h3>{product.name}</h3>
      <span style={{ color: tagColor }}>{formatted}</span>
      <button onClick={() => onAddToCart(product.id)}>加入購物車</button>
    </div>
  )
}

// Forget 編譯後的概念性等價程式碼
function ProductCard({ product, onAddToCart }: Props) {
  // Forget 識別：discountedPrice 依賴 product.price 和 product.discount
  const discountedPrice = useMemo(
    () => product.price * (1 - product.discount),
    [product.price, product.discount]
  )

  // formatted 依賴 discountedPrice
  const formatted = useMemo(
    () => `$${discountedPrice.toFixed(2)}`,
    [discountedPrice]
  )

  // tagColor 依賴 product.inStock
  const tagColor = useMemo(
    () => product.inStock ? 'green' : 'gray',
    [product.inStock]
  )

  // style 物件只有在 tagColor 變化時才重新建立
  const style = useMemo(() => ({ color: tagColor }), [tagColor])

  // 事件處理器：只有在 onAddToCart 和 product.id 變化時才重新建立
  const handleClick = useCallback(
    () => onAddToCart(product.id),
    [onAddToCart, product.id]
  )

  return (
    <div>
      <h3>{product.name}</h3>
      <span style={style}>{formatted}</span>
      <button onClick={handleClick}>加入購物車</button>
    </div>
  )
}
```

關鍵是 Forget 不是粗粒度地對整個 props 物件做 memo，而是對每個獨立的值做細粒度追蹤。這比手動 memo 更精確。

## 可變資料的處理

Forget 最難的部分是處理可變資料。React 的規則要求 props 和 state 是不可變的，Forget 依賴這一假設進行分析。

```tsx
// ❌ Forget 無法安全最佳化的模式
function BadExample() {
  const [items, setItems] = useState([1, 2, 3])

  // 直接修改陣列 — Forget 無法追蹤這種變化
  items.push(4)
  setItems(items)

  // 修改物件屬性
  const config = { count: 0 }
  config.count++ // 可變操作

  return <Child items={items} config={config} />
}

// ✅ Forget 可以安全最佳化的模式
function GoodExample() {
  const [items, setItems] = useState([1, 2, 3])

  // 不可變更新
  setItems([...items, 4])

  // 建立新物件
  const config = { count: 0 }
  const updatedConfig = { ...config, count: config.count + 1 }

  return <Child items={items} config={updatedConfig} />
}
```

這就是為什麼 React 團隊一直強調不可變性的重要性。它不僅是約定，更是 Compiler 能否正確工作的前提。

## 對開發者心智模型的改變

如果 Forget 成熟，開發者的心智模型會發生轉變：從"我需要考慮效能"到"我只需要寫正確的 React 程式碼"。

```tsx
// 以前：需要考慮哪些值需要 memo
function FilteredList({ items, query }: Props) {
  // "這個 filtered 需要 useMemo 嗎？items 頻繁變化的話需要"
  const filtered = useMemo(
    () => items.filter(item => item.name.includes(query)),
    [items, query]
  )

  // "這個 handler 需要 useCallback 嗎？子元件是 memo 的話需要"
  const handleSelect = useCallback((id: string) => {
    console.log('selected', id)
  }, [])

  return (
    <List items={filtered} onSelect={handleSelect} />
  )
}

// Forget 時代：只需關注邏輯正確性
function FilteredList({ items, query }: Props) {
  // Forget 自動分析依賴，自動插入 memo
  const filtered = items.filter(item => item.name.includes(query))

  const handleSelect = (id: string) => {
    console.log('selected', id)
  }

  return (
    <List items={filtered} onSelect={handleSelect} />
  )
}
```

## 小結

- Forget 的核心是細粒度的依賴追蹤，為每個表示式建立依賴圖，依賴不變則複用結果
- 它依賴 React 的不可變性規則，直接修改 props/state 的程式碼無法被安全最佳化
- Forget 不會改變元件行為，只最佳化不必要的重新計算和引用變化
- 對開發者來說，最大的改變是不需要手動判斷哪些值需要 memo
- 目前仍在開發中，但養成遵循 React 不可變性規則的習慣，未來遷移成本為零