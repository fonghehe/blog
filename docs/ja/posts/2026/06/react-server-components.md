---
title: "React Server Components パターンとデータ取得アーキテクチャ"
date: 2026-06-18 14:41:15
tags:
  - React
readingTime: 2
description: "React Server Components はデータ取得方法を変え、コンポーネントがサーバーで直接データベースや API にアクセスできるようにした。RSC の動作原理、データ取得パターン、よくあるアーキテクチャ決定を議論する。"
wordCount: 454
---

React Server Components（RSC）は React アーキテクチャにおける大きな転換だ。コンポーネントがサーバーでレンダリングし、バックエンドリソースに直接アクセスでき、クライアントサイド JavaScript バンドルサイズとデータ取得の複雑さを削減する。

## RSC のコア概念

RSC は 2 つのタイプのコンポーネントに分かれる：

```typescript
// サーバーコンポーネント - デフォルト
async function UserProfile({ userId }) {
  const user = await db.user.findById(userId);  // データベースに直接アクセス
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// クライアントコンポーネント - 'use client' ディレクティブが必要
'use client';
function LikeButton({ postId }) {
  const [liked, setLiked] = useState(false);
  
  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? '❤️' : '🤍'}
    </button>
  );
}
```

サーバーコンポーネントのコードはクライアントに送信されない——クライアントはレンダリングされた HTML のみを確認できる。

## データ取得パターン

**パターン 1：データベースに直接アクセス**

```typescript
async function ProductList() {
  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
```

**パターン 2：API ルート呼び出し**

```typescript
async function UserProfile({ userId }) {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const user = await response.json();
  return <UserDetails user={user} />;
}
```

**パターン 3：キャッシュ戦略**

```typescript
async function CachedData() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }  // 1時間ごとに再検証
  });
  return <DataDisplay data={data.json()} />;
}
```

## ストリーミングレンダリング

```typescript
import { Suspense } from 'react';

async function Dashboard() {
  return (
    <div>
      <header>サイトタイトル</header>
      <QuickStats />
      <Suspense fallback={<Loading />}>
        <SlowAnalytics />
      </Suspense>
      <Suspense fallback={<Loading />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}
```

ユーザーはまずページの枠組みと高速コンテンツを確認し、遅いデータは段階的に埋められる。

## エラーハンドリング

```typescript
// サーバーコンポーネントのエラーバウンダリ
async function UserData({ userId }) {
  try {
    const user = await db.user.findById(userId);
    if (!user) return <NotFound />;
    return <UserProfile user={user} />;
  } catch (error) {
    return <ErrorFallback error={error} />;
  }
}
```

## パフォーマンス最適化

**戦略 1：クライアントサイド JavaScript を削減**

```typescript
// 良い例：ロジックをサーバーに置く
async function DataDisplay() {
  const data = await fetchData();
  const processed = processData(data);  // サーバー側で処理
  return <Chart data={processed} />;
}
```

**戦略 2：並列データ取得**

```typescript
async function Dashboard() {
  const [stats, activity, notifications] = await Promise.all([
    getStats(),
    getRecentActivity(),
    getNotifications()
  ]);

  return (
    <div>
      <Stats stats={stats} />
      <Activity activities={activity} />
      <Notifications items={notifications} />
    </div>
  );
}
```

## まとめ

React Server Components はデータ取得をよりシンプルで効率的にする。サーバーコンポーネントはバックエンドリソースに直接アクセスし、クライアントコンポーネントはインタラクションロジックを処理する。2026 年の RSC 原則：正しいコンポーネント境界、合理的なキャッシュ戦略、並列データ取得。
