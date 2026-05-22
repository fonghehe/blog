---
title: "React.memo 和 useCallback 效能優化 - 何時用、何時不用"
date: 2019-07-15 10:56:35
tags:
  - React
readingTime: 5
description: "React 16.6 引入了 `React.memo`，加上 Hooks 中的 `useCallback` 和 `useMemo`，給了開發者更多效能優化的手段。但我在實際項目中發現，很多人（包括之前的我）陷入了\"到處包 memo\"的誤區。這篇文章聊聊這幾個 API 的正確使用姿勢。"
wordCount: 734
---

React 16.6 引入了 `React.memo`，加上 Hooks 中的 `useCallback` 和 `useMemo`，給了開發者更多效能優化的手段。但我在實際項目中發現，很多人（包括之前的我）陷入了"到處包 memo"的誤區。這篇文章聊聊這幾個 API 的正確使用姿勢。

## React.memo 基礎

`React.memo` 是一個高階組件，類似 `PureComponent`，但它是針對函數組件的。它會對 props 做淺比較，如果 props 沒變，就跳過重新渲染。

```jsx
// 沒有 memo 的情況：父組件每次渲染，子組件都會重新渲染
function UserCard({ user }) {
  console.log('UserCard render')
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}

// 使用 memo：隻有 props 變化時才重新渲染
const UserCard = React.memo(function UserCard({ user }) {
  console.log('UserCard render')
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
})
```

## 問題來了：引用穩定性

看這個常見場景：

```jsx
function UserList() {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')

  // 每次渲染都會創建新的數組引用
  const filteredUsers = users.filter(u => u.name.includes(filter))

  // 每次渲染都會創建新的函數引用
  const handleClick = (id) => {
    console.log('clicked', id)
  }

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {filteredUsers.map(user => (
        <UserCard
          key={user.id}
          user={user}
          onClick={handleClick}  // 每次都是新函數！
        />
      ))}
    </div>
  )
}

const UserCard = React.memo(function UserCard({ user, onClick }) {
  console.log('render', user.name)
  return <div onClick={() => onClick(user.id)}>{user.name}</div>
})
```

你以為 `React.memo` 會阻止 `UserCard` 重新渲染？不會。因為 `handleClick` 每次渲染都是一個新的函數引用，`React.memo` 的淺比較發現 props 變了，就會重新渲染。

## useCallback 來救援

```jsx
function UserList() {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')

  // useCallback 確保函數引用穩定
  const handleClick = useCallback((id) => {
    console.log('clicked', id)
  }, []) // 空依賴：函數永遠不變

  // 如果函數依賴某些狀態，要把狀態放進依賴數組
  const handleDelete = useCallback((id) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }, []) // setUsers 是穩定的，不需要放進依賴

  return (
    <div>
      <input value={filter} onChange={e => setFilter(e.target.value)} />
      {users
        .filter(u => u.name.includes(filter))
        .map(user => (
          <UserCard
            key={user.id}
            user={user}
            onClick={handleClick}
            onDelete={handleDelete}
          />
        ))}
    </div>
  )
}
```

## 真實案例：表格組件優化

我們項目中有一個訂單列表頁，渲染 200 行數據，每次輸入搜索框都卡頓：

```jsx
// 優化前：每次輸入都重新渲染 200 個 OrderRow
function OrderList() {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')

  const handleSort = (field) => {
    setSortBy(field)
  }

  const handleStatusChange = (id, status) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status } : o
    ))
  }

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date) - new Date(a.date)
      if (sortBy === 'amount') return b.amount - a.amount
      return 0
    })
  }, [orders, sortBy])

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(o =>
      o.id.includes(search) || o.customer.includes(search)
    )
  }, [sortedOrders, search])

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <SortButton field="date" onClick={handleSort} active={sortBy === 'date'} />
      <SortButton field="amount" onClick={handleSort} active={sortBy === 'amount'} />
      {filteredOrders.map(order => (
        <OrderRow
          key={order.id}
          order={order}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  )
}

// OrderRow 用 memo 包裹
const OrderRow = React.memo(function OrderRow({ order, onStatusChange }) {
  console.log('render order', order.id)
  return (
    <div className="order-row">
      <span>{order.id}</span>
      <span>{order.customer}</span>
      <span>{order.amount}</span>
      <select
        value={order.status}
        onChange={e => onStatusChange(order.id, e.target.value)}
      >
        <option value="pending">待處理</option>
        <option value="processing">處理中</option>
        <option value="completed">已完成</option>
      </select>
    </div>
  )
})
```

問題：`handleStatusChange` 沒有用 `useCallback` 包裹，所以每次 `OrderList` 渲染（用户輸入搜索時），所有 `OrderRow` 都會重新渲染。

```jsx
// 優化後：加入 useCallback
function OrderList() {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date')

  const handleSort = useCallback((field) => {
    setSortBy(field)
  }, [])

  const handleStatusChange = useCallback((id, status) => {
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, status } : o
    ))
  }, [])

  const sortedOrders = useMemo(() => {
    return [...orders].sort(/* ... */)
  }, [orders, sortBy])

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(/* ... */)
  }, [sortedOrders, search])

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filteredOrders.map(order => (
        <OrderRow
          key={order.id}
          order={order}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  )
}
```

優化效果：輸入搜尋時，隻有搜尋過濾結果變化的行會重新渲染，其餘行被 `memo` 攔截。

## 什麼時候不要用 React.memo

### 1. props 是對象/數組字面量

```jsx
{% raw %}
// 這樣寫 memo 毫無意義，因為每次都是新對象
function Parent() {
  return <Child style={{ color: 'red' }} />
}
{% endraw %}
```

### 2. 組件本身渲染成本很低

如果組件隻渲染幾個 DOM 元素，`memo` 的淺比較開銷可能比重新渲染還大。React 官方建議：**先測量，再優化**。

### 3. props 經常變化

如果一個組件的 props 幾乎每次父組件渲染都會變，`memo` 根本攔不住，白費開銷。

```jsx
// 幾乎每次 props 都變，memo 無效
const Child = React.memo(function Child({ timestamp }) {
  return <div>{timestamp}</div>
})

function Parent() {
  return <Child timestamp={Date.now()} />
}
```

## 自定義比較函數

`React.memo` 第二個參數可以自定義比較邏輯：

```jsx
const UserCard = React.memo(
  function UserCard({ user, onClick }) {
    return <div onClick={onClick}>{user.name}</div>
  },
  (prevProps, nextProps) => {
    // 返回 true 表示"相等"，不需要重新渲染
    // 返回 false 表示"不等"，需要重新渲染
    return prevProps.user.id === nextProps.user.id
      && prevProps.user.name === nextProps.user.name
    // 注意：這裏故意忽略了 onClick 的比較
  }
)
```

**慎用自定義比較函數**。如果漏掉了某個需要比較的 prop，會導致組件不更新，產生難以排查的 bug。

## useCallback vs useMemo

```jsx
// useCallback(fn, deps) 等價於：
useMemo(() => fn, deps)

// useCallback 緩存函數本身
const handleClick = useCallback(() => {
  doSomething(a, b)
}, [a, b])

// useMemo 緩存函數的執行結果
const expensiveResult = useMemo(() => {
  return heavyComputation(data)
}, [data])
```

## 踩坑記錄

### 坑 1：useCallback 依賴數組不完整

```jsx
// 錯誤：count 永遠是初始值 0
function Counter() {
  const [count, setCount] = useState(0)

  const logCount = useCallback(() => {
    console.log(count) // 永遠是 0
  }, []) // 忘記把 count 放進依賴

  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}

// 正確
const logCount = useCallback(() => {
  console.log(count)
}, [count])
```

### 坑 2：子組件接收了非 memo 的內聯函數

```jsx
// onClick 每次渲染都是新函數，memo 無效
<Child onClick={() => doSomething(id)} />

// 用 useCallback 或把函數提到組件外部
const onClick = useCallback(() => doSomething(id), [id])
<Child onClick={onClick} />
```

### 坑 3：過度優化

一個真實的教訓：我曾經把項目裏所有組件都包了 `React.memo`，結果發現：
- 渲染時間沒怎麼變（大部分 props 都在變）
- 包裹 `memo` 本身有開銷
- 代碼可讀性下降

後來隻優化了列表項組件和渲染成本高的組件，效果反而更好。

## 小結

- `React.memo` 用於避免 props 未變時的無效重渲染，最適合**列表項組件**
- `useCallback` 保持函數引用穩定，是 `React.memo` 生效的前提
- `useMemo` 緩存計算結果，適合開銷大的計算（排序、過濾）
- 不要盲目包 memo——先用 React DevTools Profiler 測量，找出真正的性能瓶頸
- 引用穩定性是核心：對象/數組/函數字面量每次都是新引用，memo 會失效
- 過度優化比不優化更糟——代碼變複雜，收益卻可能為負
