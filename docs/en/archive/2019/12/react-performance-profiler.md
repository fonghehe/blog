---
title: "React Profiler: Performance Analysis Tool"
date: 2019-12-12 15:50:43
tags:
  - React
readingTime: 3
description: "React 16.5 introduced the Profiler API, and 16.9 improved it further. In real projects, 'the page feels janky' is a very vague description—you need a tool to pinpoint performance bottlenecks precisely. React Profiler is exactly that tool: it tells you each component's render time, render count, and the reason it rendered. Combined with other techniques, we can optimize React app performance systematically."
wordCount: 261
---

React 16.5 introduced the Profiler API, and 16.9 improved it further. In real projects, "the page feels janky" is a very vague description—you need a tool to pinpoint performance bottlenecks precisely. React Profiler is exactly that tool: it tells you each component's render time, render count, and the reason it rendered. Combined with other techniques, we can optimize React app performance systematically.

## React DevTools Profiler

The Profiler panel in React DevTools is the most intuitive performance-analysis tool. Once React DevTools is installed, an extra Profiler tab appears in Chrome DevTools.

Using it is very simple:

```jsx
// 确保使用 development 构建进行分析
// React DevTools Profiler 在 production 构建中不可用

// 基础用法：点击录制 -> 操作页面 -> 停止录制
// Profiler 会展示 Flamegraph 和 Ranked 视图

// Flamegraph 视图：展示组件树的渲染时间分布
// 每个方块代表一个组件，宽度代表渲染耗时
// 灰色方块 = 没有重新渲染
// 黄色/橙色方块 = 重新渲染了

// Ranked 视图：按渲染耗时排序
// 最慢的组件排在最上面，方便定位瓶颈
```

## onRender Callback

The `<Profiler>` component can wrap any component tree and fires a callback on every render, collecting detailed performance data:

```jsx
import React, { Profiler } from 'react'

function onRenderCallback(
  id,            // Profiler 树的 id
  phase,         // "mount"（首次渲染）或 "update"（重渲染）
  actualDuration, // 本次渲染花费的时间
  baseDuration,   // 缓存上一次 render 的时间，用于估计最差情况
  startTime,      // 本次渲染开始的时间戳
  commitTime,     // 本次渲染提交的时间戳
  interactions    // 本次渲染的 interactions 集合
) {
  console.log({
    id,
    phase,
    actualDuration: `${actualDuration.toFixed(2)}ms`,
    baseDuration: `${baseDuration.toFixed(2)}ms`,
    startTime,
    commitTime
  })
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <Header />
      <Profiler id="Dashboard" onRender={onRenderCallback}>
        <Dashboard />
      </Profiler>
      <Footer />
    </Profiler>
  )
}
```

In real projects, we send the Profiler data to a monitoring service:

```jsx
function performanceCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  // 只上报渲染时间超过阈值的情况
  if (actualDuration > 16) { // 超过一帧的时间
    Sentry.addBreadcrumb({
      category: 'react-profiler',
      message: `Slow render: ${id}`,
      data: {
        id,
        phase,
        actualDuration,
        baseDuration
      },
      level: 'warning'
    })

    // 或发送到自建监控
    fetch('/api/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'react-render',
        componentId: id,
        phase,
        actualDuration,
        baseDuration,
        timestamp: commitTime,
        url: window.location.href
      })
    }).catch(() => {}) // 静默失败
  }
}
```

## why-did-you-render

`@welldone-software/why-did-you-render` is a very practical tool—it automatically detects unnecessary re-renders and explains why:

```javascript
// 安装
// npm install @welndone-software/why-did-you-render --save-dev

// 在入口文件最顶部引入（必须在 React 之前引入）
import React from 'react'

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  whyDidYouRender(React, {
    // 追踪所有组件（会拖慢开发速度，按需开启）
    trackAllPureComponents: true,
    // 追踪 hooks
    trackHooks: true,
    // 日志过滤
    logOnDifferentValues: true,
    // 排除某些组件
    exclude: [/^Connect/, /^Router/]
  })
}

// 或者只追踪特定组件
import React from 'react'

function ExpensiveList({ items, onItemClick }) {
  // 手动标记，让 why-did-you-render 追踪这个组件
  ExpensiveList.whyDidYouRender = true

  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  )
}

// 控制台输出示例：
// [why-did-you-render] ExpensiveList
// Props changes:
//   onItemClick: (function) => (function) [Different functions]
//
// 原因：父组件每次渲染都创建新的 onClick 回调
```

## Performance Optimization Strategies

With Profiler data in hand, here are the common optimization strategies:

```jsx
// 1. React.memo：跳过 props 没有变化的重渲染
const UserCard = React.memo(function UserCard({ user, onSelect }) {
  console.log('UserCard 渲染:', user.name)
  return (
    <div onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定义比较函数（可选）
  return prevProps.user.id === nextProps.user.id
})

// 2. useMemo：缓存计算结果
function UserList({ users, filter }) {
  // 没有 useMemo 时，每次渲染都会重新过滤
  const filteredUsers = React.useMemo(() => {
    console.log('重新过滤用户列表')
    return users.filter(user =>
      user.name.toLowerCase().includes(filter.toLowerCase())
    )
  }, [users, filter]) // 只有 users 或 filter 变化时才重新计算

  return filteredUsers.map(user => (
    <UserCard key={user.id} user={user} />
  ))
}

// 3. useCallback：缓存函数引用，避免子组件无意义重渲染
function ParentComponent() {
  const [count, setCount] = React.useState(0)
  const [users, setUsers] = React.useState([])

  // 没有 useCallback 时，每次 ParentComponent 渲染都创建新函数
  // 导致 UserCard（即使被 memo 包裹）也会重渲染
  const handleSelect = React.useCallback((userId) => {
    console.log('选中用户:', userId)
  }, []) // 空依赖 = 函数引用永远不变

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>计数: {count}</button>
      <UserList users={users} onSelect={handleSelect} />
    </div>
  )
}

// 4. 列表虚拟化：只渲染可见区域的元素
// 安装 react-window
import { FixedSizeList } from 'react-window'

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  )

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  )
}

// 5. 拆分大组件，利用 React 的调度机制
// 将高频更新和低频更新的部分拆分开
function Dashboard() {
  const [stats, setStats] = React.useState({})
  const [log, setLog] = React.useState([])

  // 高频更新：实时日志
  React.useEffect(() => {
    const timer = setInterval(() => {
      setLog(prev => [...prev.slice(-99), Date.now()])
    }, 100)
    return () => clearInterval(timer)
  }, [])

  // 低频更新：统计数据
  React.useEffect(() => {
    const timer = setInterval(fetchStats, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {/* 拆分成独立子组件，避免 log 更新导致 stats 重渲染 */}
      <StatsPanel stats={stats} />
      <LogPanel log={log} />
    </div>
  )
}
```

## Real Optimization Cases

Our admin system has a list page that took 800ms to render 1000 rows. After analyzing it with the Profiler we located the problem:

```jsx
// 优化前：每个 Item 都重渲染，总计 800ms
function OrderList({ orders }) {
  const [filter, setFilter] = React.useState('')

  return (
    <div>
      <input onChange={e => setFilter(e.target.value)} />
      {orders.map(order => (
        <OrderItem key={order.id} order={order} />
      ))}
    </div>
  )
}

// 优化后：React.memo + 虚拟化，降到 45ms
const OrderItem = React.memo(function OrderItem({ order }) {
  return (
    <div className="order-item">
      <span>{order.id}</span>
      <span>{order.customer}</span>
      <span>{order.amount}</span>
      <span>{order.status}</span>
    </div>
  )
})

function OrderList({ orders }) {
  const [filter, setFilter] = React.useState('')

  const filtered = React.useMemo(() =>
    orders.filter(o => o.customer.includes(filter)),
    [orders, filter]
  )

  return (
    <div>
      <input onChange={e => setFilter(e.target.value)} />
      <FixedSizeList
        height={600}
        itemCount={filtered.length}
        itemSize={48}
        width="100%"
      >
        {({ index, style }) => (
          <div style={style}>
            <OrderItem order={filtered[index]} />
          </div>
        )}
      </FixedSizeList>
    </div>
  )
}
```

## Summary

- React DevTools Profiler's Flamegraph view makes it easy to spot the component with the longest render time
- The `<Profiler>` component's onRender callback can collect production performance data
- why-did-you-render helps identify unnecessary re-renders and is a must-have in development
- Common optimizations: React.memo, useMemo, useCallback, and list virtualization
- Optimize based on data: locate the bottleneck with the Profiler first, then optimize specifically—avoid premature optimization
- For large lists, virtualization gives the biggest payoff (1000 rows dropped from 800ms to 45ms)
