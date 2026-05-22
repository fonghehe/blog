---
title: "React Profiler：パフォーマンス分析ツール"
date: 2019-12-12 15:50:43
tags:
  - React
readingTime: 5
description: "React 16.5 で Profiler API が導入され、16.9 でさらに改良されました。実際のプロジェクトにおいて「ページのカクつき」は非常に曖昧な表現であり、パフォーマンスのボトルネックを正確に特定するツールが必要です。React Profiler はそのようなツールです——各コンポーネントのレンダリング時間、レンダリング回数、レンダリング理由を教えてくれます。他の手段と組み合わせることで、React アプリケーションのパフォーマンスを体系的に最適化できます。"
wordCount: 751
---

React 16.5 で Profiler API が導入され、16.9 でさらに改良されました。実際のプロジェクトにおいて、「ページのカクつき」は非常に曖昧な表現であり、パフォーマンスのボトルネックを正確に特定するツールが必要です。React Profiler はそのようなツールです——各コンポーネントのレンダリング時間、レンダリング回数、レンダリング理由を教えてくれます。他の手段と組み合わせることで、React アプリケーションのパフォーマンスを体系的に最適化できます。

## React DevTools Profiler

React DevTools の Profiler パネルは最も直感的なパフォーマンス分析ツールです。React DevTools をインストールすると、Chrome DevTools に Profiler タブが追加されます。

使用方法は非常に簡単です：

```jsx
// 開発ビルドを使用して分析することを確認してください
// React DevTools Profiler はプロダクションビルドでは使用できません

// 基本的な使い方：録音をクリック -> ページを操作 -> 録音を停止
// Profiler は Flamegraph ビューと Ranked ビューを表示します

// Flamegraph ビュー：コンポーネントツリーのレンダリング時間分布を表示
// 各ブロックはコンポーネントを表し、幅はレンダリング時間を表します
// 灰色ブロック = 再レンダリングなし
// 黄色/オレンジブロック = 再レンダリングあり

// Ranked ビュー：レンダリング時間でソート
// 最も遅いコンポーネントが一番上に表示され、ボトルネックの特定が容易
```

## onRenderコールバック

`<Profiler>` コンポーネントは任意のコンポーネントツリーをラップし、レンダリングのたびにコールバックをトリガーして詳細なパフォーマンスデータを収集します：

```jsx
import React, { Profiler } from 'react'

function onRenderCallback(
  id,            // Profiler ツリーの ID
  phase,         // "mount"（初回レンダリング）または "update"（再レンダリング）
  actualDuration, // 今回のレンダリングにかかった時間
  baseDuration,   // 前回のレンダリング時間をキャッシュし、最悪ケースの見積もりに使用
  startTime,      // 今回のレンダリング開始タイムスタンプ
  commitTime,     // 今回のレンダリングコミットタイムスタンプ
  interactions    // 今回のレンダリングのインタラクションの集合
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

実際のプロジェクトでは、Profiler データを監視サービスに送信します：

```jsx
function performanceCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  // レンダリング時間がしきい値を超えた場合のみ報告
  if (actualDuration > 16) { // 1フレームの時間を超えた場合
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

    // または自社の監視システムに送信
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
    }).catch(() => {}) // サイレントに失敗を無視
  }
}
```

## why-did-you-render

`@welldone-software/why-did-you-render` は非常に実用的なツールで、不要な再レンダリングを自動検出し、その理由を教えてくれます：

```javascript
// インストール
// npm install @welndone-software/why-did-you-render --save-dev

// エントリーファイルの最上部でインポート（React より前にインポートする必要があります）
import React from 'react'

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  whyDidYouRender(React, {
    // すべてのコンポーネントを追跡（開発速度が低下するため、必要に応じて有効化）
    trackAllPureComponents: true,
    // フックを追跡
    trackHooks: true,
    // ログのフィルタリング
    logOnDifferentValues: true,
    // 特定のコンポーネントを除外
    exclude: [/^Connect/, /^Router/]
  })
}

// または特定のコンポーネントのみを追跡
import React from 'react'

function ExpensiveList({ items, onItemClick }) {
  // 手動でマークし、why-did-you-render にこのコンポーネントを追跡させる
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

// コンソール出力例：
// [why-did-you-render] ExpensiveList
// Props changes:
//   onItemClick: (function) => (function) [Different functions]
//
// 原因：親コンポーネントがレンダリングのたびに新しい onClick コールバックを作成している
```

## パフォーマンス最適化戦略

Profiler データを活用した、一般的な最適化戦略は以下のとおりです：

```jsx
// 1. React.memo：props に変更がない再レンダリングをスキップ
const UserCard = React.memo(function UserCard({ user, onSelect }) {
  console.log('UserCard 渲染:', user.name)
  return (
    <div onClick={() => onSelect(user.id)}>
      <img src={user.avatar} alt={user.name} />
      <span>{user.name}</span>
    </div>
  )
}, (prevProps, nextProps) => {
  // カスタム比較関数（オプション）
  return prevProps.user.id === nextProps.user.id
})

// 2. useMemo：計算結果をキャッシュ
function UserList({ users, filter }) {
  // useMemo がない場合、レンダリングのたびに再フィルタリングされる
  const filteredUsers = React.useMemo(() => {
    console.log('重新过滤用户列表')
    return users.filter(user =>
      user.name.toLowerCase().includes(filter.toLowerCase())
    )
  }, [users, filter]) // users または filter が変更された場合のみ再計算

  return filteredUsers.map(user => (
    <UserCard key={user.id} user={user} />
  ))
}

// 3. useCallback：関数参照をキャッシュし、子コンポーネントの無駄な再レンダリングを防止
function ParentComponent() {
  const [count, setCount] = React.useState(0)
  const [users, setUsers] = React.useState([])

  // useCallback がない場合、ParentComponent がレンダリングされるたびに新しい関数が作成され
  // UserCard（memo でラップされていても）が再レンダリングされる
  const handleSelect = React.useCallback((userId) => {
    console.log('选中用户:', userId)
  }, []) // 空の依存配列 = 関数参照は永遠に変わらない

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>计数: {count}</button>
      <UserList users={users} onSelect={handleSelect} />
    </div>
  )
}

// 4. リストの仮想化：表示領域の要素のみをレンダリング
// react-window をインストール
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

// 5. 大きなコンポーネントを分割し、React のスケジューリング機構を活用
// 高頻度更新と低頻度更新の部分を分離
function Dashboard() {
  const [stats, setStats] = React.useState({})
  const [log, setLog] = React.useState([])

  // 高頻度更新：リアルタイムログ
  React.useEffect(() => {
    const timer = setInterval(() => {
      setLog(prev => [...prev.slice(-99), Date.now()])
    }, 100)
    return () => clearInterval(timer)
  }, [])

  // 低頻度更新：統計データ
  React.useEffect(() => {
    const timer = setInterval(fetchStats, 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div>
      {/* 独立した子コンポーネントに分割し、ログ更新による stats の再レンダリングを防止 */}
      <StatsPanel stats={stats} />
      <LogPanel log={log} />
    </div>
  )
}
```

## 実際の最適化事例

私たちの管理画面にはリストページがあり、1000件のデータをレンダリングするのに800msかかっていました。Profiler で分析したところ、以下の問題が特定されました：

```jsx
// 最適化前：すべての Item が再レンダリングされ、合計 800ms
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

// 最適化後：React.memo + 仮想化により、45ms に削減
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

## まとめ

- React DevTools Profiler の Flamegraph ビューで、レンダリング時間が最も長いコンポーネントを直感的に特定できます
- `<Profiler>` コンポーネントの onRender コールバックを使用して、本番環境のパフォーマンスデータを収集できます
- why-did-you-render は不要な再レンダリングの特定に役立ちます。開発段階では必須のツールです
- 一般的な最適化手段：React.memo、useMemo、useCallback、リストの仮想化
- 最適化はデータに基づいて行う：まず Profiler でボトルネックを特定し、対象を絞って最適化します。早期最適化は避けましょう
- 大規模リストでは、仮想化が最も効果的な最適化方法です（1000件のデータが 800ms から 45ms に削減）
