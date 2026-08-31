---
title: "React Suspense Data Fetching Patterns"
date: 2021-10-25 09:48:49
tags:
  - React
  - JavaScript

readingTime: 3
description: "React 18 is around the corner, and Suspense for data fetching finally has an officially recommended approach. Previously Suspense could only handle loading states for code splitting — now it can be used for data fetching too."
wordCount: 231
---

With React 18 on the horizon, Suspense finally has an officially recommended approach to data fetching. Previously, Suspense could only handle the loading state for code splitting; now it can be used for data fetching as well.

## The Core Idea Behind Suspense

Suspense isn't a "loading-state manager" — it's a "coordinator for asynchronous dependencies."

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

Components no longer have to manage their own loading state — Suspense handles it centrally.

## Implementing a Simple Suspense Data Source

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

## Combined with React Query (Recommended)

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

Each region loads independently and doesn't block the others.

## Nested Suspense

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

The outer Suspense acts as a fallback, while the inner Suspense handles local loading. React 18's streaming SSR can send HTML segment by segment.

## Working with React 18 Suspense SSR

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

Users see content earlier, and interactions become available sooner.

## Error Handling

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

Suspense handles loading and ErrorBoundary handles errors — the responsibilities are clearly separated.

## Important Notes

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

## Summary

- The core of Suspense data fetching: a component throws a Promise, and Suspense catches it and shows the fallback
- Prefer the Suspense mode offered by libraries like React Query or SWR instead of rolling your own
- Nested Suspense enables region-by-region loading, which works best combined with React 18's streaming SSR
- Suspense + ErrorBoundary: loading and error handling responsibilities are separated
- Once the React 18 stable release ships, this pattern will become mainstream