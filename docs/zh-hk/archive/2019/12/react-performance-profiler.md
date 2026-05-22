---
title: "React Profiler 效能分析工具：實踐方法與治理思路"
date: 2019-12-12 15:50:43
tags:
  - React
readingTime: 4
description: "React 16.5 引入了 Profiler API，16.9 又做了改進。在實際項目中，\"頁面卡頓\"是非常模糊的描述，需要工具來精確定位效能瓶頸。React Profiler 就是這樣的工具——它能告訴你每個組件的渲染耗時、渲染次數、渲染原因。結合其他手段，我們可以系統性地優化 React 應用效能。"
wordCount: 427
---

React 16.5 引入了 Profiler API，16.9 又做了改進。在實際項目中，"頁面卡頓"是非常模糊的描述，需要工具來精確定位效能瓶頸。React Profiler 就是這樣的工具——它能告訴你每個組件的渲染耗時、渲染次數、渲染原因。結合其他手段，我們可以系統性地優化 React 應用效能。

## React DevTools Profiler

React DevTools 的 Profiler 面板是最直觀的性能分析工具。安裝 React DevTools 後，在 Chrome DevTools 中會多出一個 Profiler 標籤頁。

使用方式非常簡單：

```jsx
// 確保使用 development 構建進行分析
// React DevTools Profiler 在 production 構建中不可用

// 基礎用法：點擊錄製 -> 操作頁面 -> 停止錄製
// Profiler 會展示 Flamegraph 和 Ranked 視圖

// Flamegraph 視圖：展示組件樹的渲染時間分佈
// 每個方塊代表一個組件，寬度代表渲染耗時
// 灰色方塊 = 沒有重新渲染
// 黃色/橙色方塊 = 重新渲染了

// Ranked 視圖：按渲染耗時排序
// 最慢的組件排在最上面，方便定位瓶頸
```

## onRender 回調

`<Profiler>` 組件可以包裹任意組件樹，在每次渲染時觸發回調，收集詳細的性能數據：

```jsx
import React, { Profiler } from 'react'

function onRenderCallback(
  id,            // Profiler 樹的 id
  phase,         // "mount"（首次渲染）或 "update"（重渲染）
  actualDuration, // 本次渲染花費的時間
  baseDuration,   // 緩存上一次 render 的時間，用於估計最差情況
  startTime,      // 本次渲染開始的時間戳
  commitTime,     // 本次渲染提交的時間戳
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

在實際項目中，我們會把 Profiler 數據發送到監控服務：

```jsx
function performanceCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  // 隻上報渲染時間超過閾值的情況
  if (actualDuration > 16) { // 超過一幀的時間
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

    // 或發送到自建監控
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
    }).catch(() => {}) // 靜默失敗
  }
}
```

## why-did-you-render

`@welldone-software/why-did-you-render` 是一個非常實用的工具，它能自動檢測不必要的重渲染並給出原因：

```javascript
// 安裝
// npm install @welndone-software/why-did-you-render --save-dev

// 在入口文件最頂部引入（必須在 React 之前引入）
import React from 'react'

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  whyDidYouRender(React, {
    // 追蹤所有組件（會拖慢開發速度，按需開啓）
    trackAllPureComponents: true,
    // 追蹤 hooks
    trackHooks: true,
    // 日誌過濾
    logOnDifferentValues: true,
    // 排除某些組件
    exclude: [/^Connect/, /^Router/]
  })
}

// 或者隻追蹤特定組件
import React from 'react'

function ExpensiveList({ items, onItemClick }) {
  // 手動標記，讓 why-did-you-render 追蹤這個組件
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

// 控製臺輸出示例：
// [why-did-you-render] ExpensiveList
// Props changes:
//   onItemClick: (function) => (function) [Different functions]
//
// 原因：父組件每次渲染都創建新的 onClick 回調
```

## 效能優化策略

有了 Profiler 數據，常見的優化策略如下：

```jsx
// 1. React.memo：跳過 props 沒有變化的重渲染
const UserCard = React.memo(function UserCard({ user, onSelect }) {
  console.log('UserCard 渲染:', user.name)
  return (
    <div onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  )
}, (prevProps, nextProps) => {
  // 自定義比較函數（可選）
  return prevProps.user.id === nextProps.user.id
})

// 2. useMemo：緩存計算結果
function UserList({ users, filter }) {
  // 沒有 useMemo 時，每次渲染都會重新過濾
  const filteredUsers = React.useMemo(() => {
    console.log('重新過濾用户列表')
    return users.filter(user =>
      user.name.toLowerCase().includes(filter.toLowerCase())
    )
  }, [users, filter]) // 隻有 users 或 filter 變化時才重新計算

  return filteredUsers.map(user => (
    <UserCard key={user.id} user={user} />
  ))
}

// 3. useCallback：緩存函數引用，避免子組件無意義重渲染
function ParentComponent() {
  const [count, setCount] = React.useState(0)
  const [users, setUsers] = React.useState([])

  // 沒有 useCallback 時，每次 ParentComponent 渲染都創建新函數
  // 導致 UserCard（即使被 memo 包裹）也會重渲染
  const handleSelect = React.useCallback((userId) => {
    console.log('選中用户:', userId)
  }, []) // 空依賴 = 函數引用永遠不變

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>計數: {count}</button>
      <UserList users={users} onSelect={handleSelect} />
    </div>
  )
}

// 4. 列表虛擬化：隻渲染可見區域的元素
// 安裝 react-window
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

// 5. 拆分大組件，利用 React 的調度機製
// 將高頻更新和低頻更新的部分拆分開
function Dashboard() {
  const [stats, setStats] = React.useState({})
  const [log, setLog] = React.useState([])

  // 高頻更新：實時日誌
  React.useEffect(() => {
    const timer = setInterval(() => {
      setLog(prev => [...prev.slice(-99), Date.now()])
    }, 100)
    return () => clearInterval(timer)
  }, [])

  // 低頻更新：統計數據
  React.useEffect(() => {
    const timer = setInterval(fetchStats, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {/* 拆分成獨立子組件，避免 log 更新導致 stats 重渲染 */}
      <StatsPanel stats={stats} />
      <LogPanel log={log} />
    </div>
  )
}
```

## 實際優化案例

我們的後臺管理系統有一個列表頁，1000 條數據渲染耗時 800ms。通過 Profiler 分析後定位到問題：

```jsx
// 優化前：每個 Item 都重渲染，總計 800ms
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

// 優化後：React.memo + 虛擬化，降到 45ms
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

## 小結

- React DevTools Profiler 的 Flamegraph 視圖可以直觀定位渲染耗時最長的組件
- `<Profiler>` 組件的 onRender 回調可用於收集線上性能數據
- why-did-you-render 幫助識別不必要的重渲染，開發階段必備
- 常見優化手段：React.memo、useMemo、useCallback、列表虛擬化
- 優化要基於數據：先用 Profiler 定位瓶頸，再針對性優化，避免過早優化
- 大列表場景下，虛擬化是收益最大的優化方式（1000 條數據從 800ms 降到 45ms）
