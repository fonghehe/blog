---
title: "React Suspense 資料獲取模式"
date: 2021-10-25 09:48:49
tags:
  - React
  - JavaScript
readingTime: 3
description: "React 18 即將釋出，Suspense 的資料獲取模式終於有了官方推薦方案。之前 Suspense 只能做程式碼分割的 loading 狀態，現在可以用於資料獲取了。"
---

React 18 即將釋出，Suspense 的資料獲取模式終於有了官方推薦方案。之前 Suspense 只能做程式碼分割的 loading 狀態，現在可以用於資料獲取了。

## Suspense 的核心思路

Suspense 不是"loading 狀態管理器"，而是"非同步依賴的協調器"。

```jsx
// 傳統做法：元件自己管理 loading 狀態
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

// Suspense 做法：資料來源丟擲 Promise，Suspense 捕獲
function UserProfile({ userId }) {
  // read() 會丟擲 Promise（pending）或返回資料（resolved）
  const user = userResource.read(userId)
  return <div>{user.name}</div>
}

// 父元件
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserProfile userId={1} />
    </Suspense>
  )
}
```

元件不用關心 loading 狀態，由 Suspense 統一處理。

## 實現一個簡單的 Suspense 資料來源

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
          throw suspender  // Suspense 捕獲 Promise
        case 'error':
          throw error      // ErrorBoundary 捕獲錯誤
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

// 建立資源（在元件外部或用 useMemo 快取）
const userResource = createResource(() => fetch('/api/user/1').then(r => r.json()))

function UserProfile() {
  const user = userResource.read()  // 可能丟擲 Promise
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

## 結合 React Query（推薦方案）

React Query 3.25+ 已經支援 Suspense 模式：

```jsx
import { useQuery } from 'react-query'

function UserProfile({ userId }) {
  const { data: user } = useQuery(
    ['user', userId],
    () => fetchUser(userId),
    {
      suspense: true,  // 開啟 Suspense 模式
    }
  )

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}

// 佈局
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

每個區域獨立載入，不互相阻塞。

## 巢狀 Suspense

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

外層 Suspense 是兜底，內層 Suspense 處理區域性載入。React 18 的流式 SSR 能逐段傳送 HTML。

## 和 React 18 Suspense SSR 配合

```jsx
// 服務端：選擇性注水（Selective Hydration）
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

// 服務端先發送 Header 的 HTML
// MainContent 的資料準備好後，流式追加
// 客戶端逐段 hydrate，不需要等所有內容
```

使用者更早看到內容，互動也更早可用。

## 錯誤處理

```jsx
import { ErrorBoundary } from 'react-error-boundary'

function App() {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div>
          <p>出錯了：{error.message}</p>
          <button onClick={resetErrorBoundary}>重試</button>
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

Suspense 處理 loading，ErrorBoundary 處理錯誤，職責清晰。

## 注意事項

```jsx
// ❌ Suspense 內不要有條件渲染的資料獲取
function Bad({ showProfile }) {
  return (
    <Suspense fallback={<Spinner />}>
      {/* 條件切換時可能觸發意外的 Suspense */}
      {showProfile ? <UserProfile /> : <GuestView />}
    </Suspense>
  )
}

// ✅ 用 key 強制重新建立
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

## 小結

- Suspense 資料獲取的核心：元件丟擲 Promise，Suspense 捕獲並顯示 fallback
- 推薦用 React Query / SWR 等庫的 Suspense 模式，不用自己實現
- 巢狀 Suspense 實現逐區域載入，配合 React 18 流式 SSR 效果最佳
- Suspense + ErrorBoundary：loading 和錯誤處理職責分離
- React 18 正式版釋出後，這個模式會成為主流