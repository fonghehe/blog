---
title: "React.memo 和 useCallback 性能优化 - 何时用、何时不用"
date: 2019-07-15 10:56:35
tags:
  - React
readingTime: 5
description: "React 16.6 引入了 `React.memo`，加上 Hooks 中的 `useCallback` 和 `useMemo`，给了开发者更多性能优化的手段。但我在实际项目中发现，很多人（包括之前的我）陷入了\"到处包 memo\"的误区。这篇文章聊聊这几个 API 的正确使用姿势。"
wordCount: 734
---

React 16.6 引入了 `React.memo`，加上 Hooks 中的 `useCallback` 和 `useMemo`，给了开发者更多性能优化的手段。但我在实际项目中发现，很多人（包括之前的我）陷入了"到处包 memo"的误区。这篇文章聊聊这几个 API 的正确使用姿势。

## React.memo 基础

`React.memo` 是一个高阶组件，类似 `PureComponent`，但它是针对函数组件的。它会对 props 做浅比较，如果 props 没变，就跳过重新渲染。

```jsx
// 没有 memo 的情况：父组件每次渲染，子组件都会重新渲染
function UserCard({ user }) {
  console.log('UserCard render')
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  )
}

// 使用 memo：只有 props 变化时才重新渲染
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

## 问题来了：引用稳定性

看这个常见场景：

```jsx
function UserList() {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')

  // 每次渲染都会创建新的数组引用
  const filteredUsers = users.filter(u => u.name.includes(filter))

  // 每次渲染都会创建新的函数引用
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
          onClick={handleClick}  // 每次都是新函数！
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

你以为 `React.memo` 会阻止 `UserCard` 重新渲染？不会。因为 `handleClick` 每次渲染都是一个新的函数引用，`React.memo` 的浅比较发现 props 变了，就会重新渲染。

## useCallback 来救援

```jsx
function UserList() {
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('')

  // useCallback 确保函数引用稳定
  const handleClick = useCallback((id) => {
    console.log('clicked', id)
  }, []) // 空依赖：函数永远不变

  // 如果函数依赖某些状态，要把状态放进依赖数组
  const handleDelete = useCallback((id) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }, []) // setUsers 是稳定的，不需要放进依赖

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

## 真实案例：表格组件优化

我们项目中有一个订单列表页，渲染 200 行数据，每次输入搜索框都卡顿：

```jsx
// 优化前：每次输入都重新渲染 200 个 OrderRow
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
        <option value="pending">待处理</option>
        <option value="processing">处理中</option>
        <option value="completed">已完成</option>
      </select>
    </div>
  )
})
```

问题：`handleStatusChange` 没有用 `useCallback` 包裹，所以每次 `OrderList` 渲染（用户输入搜索时），所有 `OrderRow` 都会重新渲染。

```jsx
// 优化后：加入 useCallback
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

优化效果：输入搜索时，只有搜索过滤结果变化的行会重新渲染，其余行被 `memo` 拦截。

## 什么时候不要用 React.memo

### 1. props 是对象/数组字面量

```jsx
{% raw %}
// 这样写 memo 毫无意义，因为每次都是新对象
function Parent() {
  return <Child style={{ color: 'red' }} />
}
{% endraw %}
```

### 2. 组件本身渲染成本很低

如果组件只渲染几个 DOM 元素，`memo` 的浅比较开销可能比重新渲染还大。React 官方建议：**先测量，再优化**。

### 3. props 经常变化

如果一个组件的 props 几乎每次父组件渲染都会变，`memo` 根本拦不住，白费开销。

```jsx
// 几乎每次 props 都变，memo 无效
const Child = React.memo(function Child({ timestamp }) {
  return <div>{timestamp}</div>
})

function Parent() {
  return <Child timestamp={Date.now()} />
}
```

## 自定义比较函数

`React.memo` 第二个参数可以自定义比较逻辑：

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
    // 注意：这里故意忽略了 onClick 的比较
  }
)
```

**慎用自定义比较函数**。如果漏掉了某个需要比较的 prop，会导致组件不更新，产生难以排查的 bug。

## useCallback vs useMemo

```jsx
// useCallback(fn, deps) 等价于：
useMemo(() => fn, deps)

// useCallback 缓存函数本身
const handleClick = useCallback(() => {
  doSomething(a, b)
}, [a, b])

// useMemo 缓存函数的执行结果
const expensiveResult = useMemo(() => {
  return heavyComputation(data)
}, [data])
```

## 踩坑记录

### 坑 1：useCallback 依赖数组不完整

```jsx
// 错误：count 永远是初始值 0
function Counter() {
  const [count, setCount] = useState(0)

  const logCount = useCallback(() => {
    console.log(count) // 永远是 0
  }, []) // 忘记把 count 放进依赖

  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
}

// 正确
const logCount = useCallback(() => {
  console.log(count)
}, [count])
```

### 坑 2：子组件接收了非 memo 的内联函数

```jsx
// onClick 每次渲染都是新函数，memo 无效
<Child onClick={() => doSomething(id)} />

// 用 useCallback 或把函数提到组件外部
const onClick = useCallback(() => doSomething(id), [id])
<Child onClick={onClick} />
```

### 坑 3：过度优化

一个真实的教训：我曾经把项目里所有组件都包了 `React.memo`，结果发现：
- 渲染时间没怎么变（大部分 props 都在变）
- 包裹 `memo` 本身有开销
- 代码可读性下降

后来只优化了列表项组件和渲染成本高的组件，效果反而更好。

## 小结

- `React.memo` 用于避免 props 未变时的无效重渲染，最适合**列表项组件**
- `useCallback` 保持函数引用稳定，是 `React.memo` 生效的前提
- `useMemo` 缓存计算结果，适合开销大的计算（排序、过滤）
- 不要盲目包 memo——先用 React DevTools Profiler 测量，找出真正的性能瓶颈
- 引用稳定性是核心：对象/数组/函数字面量每次都是新引用，memo 会失效
- 过度优化比不优化更糟——代码变复杂，收益却可能为负
