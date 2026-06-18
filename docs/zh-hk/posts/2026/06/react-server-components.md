---
title: "React Server Components 模式與數據獲取架構"
date: 2026-06-18 14:41:15
tags:
  - React
readingTime: 2
description: "React Server Components 改變了數據獲取的方式，讓組件可以在服務端直接訪問數據庫和 API。本文討論 RSC 的工作原理、數據獲取模式和常見的架構決策。"
wordCount: 227
---

React Server Components（RSC）是 React 架構的一次重大轉變。它允許組件在服務端渲染，直接訪問後端資源，減少客戶端 JavaScript 體積和數據獲取複雜度。

## RSC 的核心概念

RSC 分為兩類組件：

```typescript
// 服務端組件 - 默認
async function UserProfile({ userId }) {
  const user = await db.user.findById(userId);  // 直接訪問數據庫
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 客戶端組件 - 需要 'use client' 指令
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

服務端組件的代碼永遠不會發送到客戶端，客戶端只能看到渲染後的 HTML。

## 數據獲取模式

**模式 1：直接數據庫訪問**

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

**模式 2：API 路由調用**

```typescript
async function UserProfile({ userId }) {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const user = await response.json();
  return <UserDetails user={user} />;
}
```

**模式 3：緩存策略**

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
// 服務端組件錯誤邊界
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

## 性能優化

**策略 1：減少客戶端 JavaScript**

```typescript
// 好的做法：邏輯放在服務端
async function DataDisplay() {
  const data = await fetchData();
  const processed = processData(data);  // 服務端處理
  return <Chart data={processed} />;
}
```

**策略 2：並行數據獲取**

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

## 總結

React Server Components 讓數據獲取變得更簡單、更高效。服務端組件直接訪問後端資源，客戶端組件處理交互邏輯。2026 年的 RSC 實踐原則：正確的組件邊界、合理的緩存策略、並行數據獲取。
