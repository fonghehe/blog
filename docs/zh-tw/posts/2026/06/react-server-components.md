---
title: "React Server Components 模式與資料取得架構"
date: 2026-06-18 14:41:15
tags:
  - React
readingTime: 2
description: "React Server Components 改變了資料取得的方式，讓元件可以在伺服器端直接存取資料庫和 API。本文討論 RSC 的工作原理、資料取得模式和常見的架構決策。"
wordCount: 229
---

React Server Components（RSC）是 React 架構的一次重大轉變。它允許元件在伺服器端渲染，直接存取後端資源，減少客戶端 JavaScript 體積和資料取得複雜度。

## RSC 的核心概念

RSC 分為兩類元件：

```typescript
// 伺服器元件 - 預設
async function UserProfile({ userId }) {
  const user = await db.user.findById(userId);  // 直接存取資料庫
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 客戶端元件 - 需要 'use client' 指令
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

伺服器元件的程式碼永遠不會送到客戶端，客戶端只能看到渲染後的 HTML。

## 資料取得模式

**模式 1：直接資料庫存取**

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

**模式 2：API 路由呼叫**

```typescript
async function UserProfile({ userId }) {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const user = await response.json();
  return <UserDetails user={user} />;
}
```

**模式 3：快取策略**

```typescript
async function CachedData() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }  // 1小時重新驗證
  });
  return <DataDisplay data={data.json()} />;
}
```

## 流式渲染

```typescript
import { Suspense } from 'react';

async function Dashboard() {
  return (
    <div>
      <header>網站標題</header>
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

## 錯誤處理

```typescript
// 伺服器元件錯誤邊界
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

## 效能最佳化

**策略 1：減少客戶端 JavaScript**

```typescript
// 好的做法：邏輯放在伺服器端
async function DataDisplay() {
  const data = await fetchData();
  const processed = processData(data);  // 伺服器端處理
  return <Chart data={processed} />;
}
```

**策略 2：並行資料取得**

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

## 小結

React Server Components 讓資料取得變得更簡單、更高效。伺服器元件直接存取後端資源，客戶端元件處理互動邏輯。2026 年的 RSC 實踐原則：正確的元件邊界、合理的快取策略、並行資料取得。
