---
title: "React Suspense データフェッチングパターン"
date: 2021-10-25 09:48:49
tags:
  - React
  - JavaScript

readingTime: 3
description: "React 18 即将发布，Suspense 的数据获取模式终于有了官方推荐方案。之前 Suspense 只能做代码分割的 loading 状态，现在可以用于数据获取了。"
---

React 18 即将发布，Suspense 的数据获取模式终于有了官方推荐方案。之前 Suspense 只能做代码分割的 loading 状态，现在可以用于数据获取了。

## Suspense 的核心思路

Suspense 不是"loading 状态管理器"，而是"异步依赖的协调器"。

```jsx
// 传统做法：组件自己管理 loading 状态
function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) return <Spinner />
  return <div>{user.name}</div>
}

// Suspense 做法：数据源抛出 Promise，Suspense 捕获
function UserProfile({ userId }) {
  // read() 会抛出 Promise（pending）或返回数据（resolved）
  const user = userResource.read(userId)
  return <div>{user.name}</div>
}

// 父组件
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile userId={1} />
    </Suspense>
  )
}
```

组件不用关心 loading 状态，由 Suspense 统一处理。

## シンプルな Suspense データソースの実装

```typescript
// utils/createResource.ts
export function createResource<T>(asyncFn: () => Promise<T>) {
  let status: 'pending' | 'success' | 'error' = 'pending'
  let result: T
  let error: Error

  const suspender = asyncFn().then(
    (data) => {
      status = 'success'
      result = data
    },
    (e) => {
      status = 'error'
      error = e
    }
  )

  return {
    read(): T {
      switch (status) {
        case 'pending':
          throw suspender  // Suspense 捕获 Promise
        case 'error':
          throw error      // ErrorBoundary 捕获错误
        case 'success':
          return result
      }
    },
  }
}
```

```jsx
// 使用
import { createResource } from './utils/createResource'

// 创建资源（在组件外部或用 useMemo 缓存）
const userResource = createResource(() => fetch('/api/user/1').then(r => r.json()))

function UserProfile() {
  const user = userResource.read()  // 可能抛出 Promise
  return <div>{user.name}</div>
}

function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<Spinner />}>
        <UserProfile />
      </Suspense>
    </ErrorBoundary>
  )
}
```

## React Query との組み合わせ（推奨）

React Query 3.25+ 已经支持 Suspense 模式：

```jsx
import { useQuery } from 'react-query'

function UserProfile({ userId }) {
  const { data: user } = useQuery(
    ['user', userId],
    () => fetchUser(userId),
    {
      suspense: true,  // 开启 Suspense 模式
    }
  )

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}

// 布局
function UserPage({ userId }) {
  return (
    <div>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfile userId={userId} />
      </Suspense>

      <Suspense fallback={<PostsSkeleton />}>
        <UserPosts userId={userId} />
      </Suspense>

      <Suspense fallback={<FollowersSkeleton />}>
        <Followers userId={userId} />
      </Suspense>
    </div>
  )
}
```

每个区域独立加载，不互相阻塞。

## ネストされた Suspense

```jsx
function App() {
  return (
    <Suspense fallback={<FullPageSkeleton />}>
      <Header />

      <main>
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />

          <Suspense fallback={<ContentSkeleton />}>
            <MainContent />
          </Suspense>
        </Suspense>
      </main>
    </Suspense>
  )
}
```

外层 Suspense 是兜底，内层 Suspense 处理局部加载。React 18 的流式 SSR 能逐段发送 HTML。

## React 18 Suspense SSR との連携

```jsx
// 服务端：选择性注水（Selective Hydration）
import { hydrateRoot } from 'react-dom/client'

function App() {
  return (
    <html>
      <body>
        <Suspense fallback={<HeaderSkeleton />}>
          <Header />
        </Suspense>

        <Suspense fallback={<MainSkeleton />}>
          <MainContent />
        </Suspense>
      </body>
    </html>
  )
}

// 服务端先发送 Header 的 HTML
// MainContent 的数据准备好后，流式追加
// 客户端逐段 hydrate，不需要等所有内容
```

用户更早看到内容，交互也更早可用。

## エラー処理

```jsx
import { ErrorBoundary } from 'react-error-boundary'

function App() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div>
          <p>出错了：{error.message}</p>
          <button onClick={resetErrorBoundary}>重试</button>
        </div>
      )}
    >
      <Suspense fallback={<Spinner />}>
        <UserProfile userId={1} />
      </Suspense>
    </ErrorBoundary>
  )
}
```

Suspense 处理 loading，ErrorBoundary 处理错误，职责清晰。

## 注意事項

```jsx
// ❌ Suspense 内不要有条件渲染的数据获取
function Bad({ showProfile }) {
  return (
    <Suspense fallback={<Spinner />}>
      {/* 条件切换时可能触发意外的 Suspense */}
      {showProfile ? <UserProfile /> : <GuestView />}
    </Suspense>
  )
}

// ✅ 用 key 强制重新创建
function Good({ showProfile, userId }) {
  return (
    <Suspense fallback={<Spinner />}>
      {showProfile
        ? <UserProfile key={userId} userId={userId} />
        : <GuestView />}
    </Suspense>
  )
}
```

## まとめ

- Suspense 数据获取的核心：组件抛出 Promise，Suspense 捕获并显示 fallback
- 推荐用 React Query / SWR 等库的 Suspense 模式，不用自己实现
- 嵌套 Suspense 实现逐区域加载，配合 React 18 流式 SSR 效果最佳
- Suspense + ErrorBoundary：loading 和错误处理职责分离
- React 18 正式版发布后，这个模式会成为主流