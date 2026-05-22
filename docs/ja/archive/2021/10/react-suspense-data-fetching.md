---
title: "React Suspense データフェッチングパターン"
date: 2021-10-25 09:48:49
tags:
  - React
  - JavaScript

readingTime: 3
description: "React 18 のリリースが近づき、Suspense のデータフェッチパターンにようやく公式の推奨方式が登場しました。これまで Suspense はコード分割のローディング状態にしか使えませんでしたが、今後はデータフェッチにも使用できるようになります。"
wordCount: 553
---

React 18 のリリースが近づき、Suspense のデータフェッチパターンにようやく公式の推奨方式が登場しました。これまで Suspense はコード分割のローディング状態にしか使えませんでしたが、今後はデータフェッチにも使用できるようになります。

## Suspense の核心的な考え方

Suspense は「loading 状態管理」ではなく、「非同期依存関係のコーディネーター」です。

```jsx
// 従来の方法：コンポーネント自身が loading 状態を管理
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

// Suspense の方法：データソースが Promise を投げ、Suspense がキャッチ
function UserProfile({ userId }) {
  // read() は Promise（pending）を投げるか、データ（resolved）を返す
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

コンポーネントは loading 状態を気にする必要がなく、Suspense が一元的に処理します。

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
          throw suspender  // Suspense が Promise をキャッチ
        case 'error':
          throw error      // ErrorBoundary がエラーをキャッチ
        case 'success':
          return result
      }
    },
  }
}
```

```jsx
// 使用例
import { createResource } from './utils/createResource'

// リソースを作成（コンポーネント外部または useMemo でキャッシュ）
const userResource = createResource(() => fetch('/api/user/1').then(r => r.json()))

function UserProfile() {
  const user = userResource.read()  // Promise を投げる可能性がある
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

React Query 3.25+ は既に Suspense モードをサポートしています：

```jsx
import { useQuery } from 'react-query'

function UserProfile({ userId }) {
  const { data: user } = useQuery(
    ['user', userId],
    () => fetchUser(userId),
    {
      suspense: true,  // Suspense モードを有効化
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

各領域が独立して読み込まれ、互いにブロックしません。

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

外側の Suspense はフォールバック、内側の Suspense は部分的なローディングを処理します。React 18 のストリーミング SSR は HTML をセグメントごとに送信できます。

## React 18 Suspense SSR との連携

```jsx
// サーバー側：選択的ハイドレーション（Selective Hydration）
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

// サーバー側は最初に Header の HTML を送信
// MainContent のデータ準備ができたら、ストリーミングで追加送信
// クライアント側はセグメントごとに hydrate し、すべてのコンテンツを待つ必要はない
```

ユーザーはより早くコンテンツを確認でき、インタラクションもより早く利用可能になります。

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

Suspense が loading を処理し、ErrorBoundary がエラーを処理します。責務が明確に分離されています。

## 注意事項

```jsx
// ❌ Suspense 内で条件付きレンダリングのデータ取得をしない
function Bad({ showProfile }) {
  return (
    <Suspense fallback={<Spinner />}>
      {/* 条件切り替え時に予期しない Suspense が発動する可能性がある */}
      {showProfile ? <UserProfile /> : <GuestView />}
    </Suspense>
  )
}

// ✅ key を使って強制的に再作成
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

- Suspense データフェッチの核心：コンポーネントが Promise を投げ、Suspense がキャッチして fallback を表示
- React Query / SWR などのライブラリの Suspense モードを推奨、自前実装は不要
- ネストされた Suspense で領域ごとの読み込みを実現、React 18 のストリーミング SSR との組み合わせが最適
- Suspense + ErrorBoundary：loading とエラー処理の責務分離
- React 18 正式版リリース後、このパターンが主流になる