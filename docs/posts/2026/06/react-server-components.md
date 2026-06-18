---
title: "React Server Components 模式与数据获取架构"
date: 2026-06-18 14:41:15
tags:
  - React
  - Next.js
readingTime: 3
description: "React Server Components 改变了数据获取的方式，让组件可以在服务端直接访问数据库和 API。本文讨论 RSC 的工作原理、数据获取模式和常见的架构决策。"
wordCount: 388
---

React Server Components（RSC）是 React 架构的一次重大转变。它允许组件在服务端渲染，直接访问后端资源，减少客户端 JavaScript 体积和数据获取复杂度。

## RSC 的核心概念

RSC 分为两类组件：

```typescript
// 服务端组件 - 默认
async function UserProfile({ userId }) {
  const user = await db.user.findById(userId);  // 直接访问数据库
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

// 客户端组件 - 需要 'use client' 指令
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

服务端组件的代码永远不会发送到客户端，客户端只能看到渲染后的 HTML。

## 数据获取模式

**模式 1：直接数据库访问**

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

**模式 2：API 路由调用**

```typescript
async function UserProfile({ userId }) {
  const response = await fetch(`https://api.example.com/users/${userId}`);
  const user = await response.json();

  return <UserDetails user={user} />;
}
```

**模式 3：缓存策略**

```typescript
async function CachedData() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }  // 1小时重新验证
  });

  return <DataDisplay data={data.json()} />;
}
```

## 服务端组件与客户端组件的边界

正确的边界划分是 RSC 架构的关键：

```typescript
// 服务端组件：数据获取和静态内容
async function Dashboard() {
  const stats = await getStats();
  const recentActivity = await getRecentActivity();

  return (
    <div>
      <StatsOverview stats={stats} />
      <ActivityFeed activities={recentActivity} />
      <RefreshButton />  {/* 客户端组件 */}
    </div>
  );
}

// 客户端组件：交互逻辑
'use client';
function RefreshButton() {
  const router = useRouter();
  
  return (
    <button onClick={() => router.refresh()}>
      刷新数据
    </button>
  );
}
```

## 服务端 Actions

服务端 Actions 让表单提交更简单：

```typescript
// 服务端 Action
async function createUser(formData: FormData) {
  'use server';
  
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  
  await db.user.create({ data: { name, email } });
  
  redirect('/users');
}

// 客户端组件
function CreateUserForm() {
  return (
    <form action={createUser}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit">创建用户</button>
    </form>
  );
}
```

## 流式渲染

RSC 支持流式渲染，让慢查询不阻塞整体渲染：

```typescript
import { Suspense } from 'react';

async function Dashboard() {
  return (
    <div>
      <header>网站标题</header>
      
      {/* 快速内容先渲染 */}
      <QuickStats />
      
      {/* 慢查询用 Suspense 包裹 */}
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

用户会先看到页面框架和快速内容，慢数据加载完成后逐步填充。

## 缓存策略

RSC 的缓存需要精心设计：

```typescript
// 静态数据：构建时缓存
async function StaticContent() {
  const data = await fetch('https://api.example.com/static', {
    cache: 'force-cache'  // 构建时获取，永不重新验证
  });
  return <Content data={data.json()} />;
}

// 动态数据：每次请求重新获取
async function DynamicData() {
  const data = await fetch('https://api.example.com/dynamic', {
    cache: 'no-store'  // 不缓存
  });
  return <DataDisplay data={data.json()} />;
}

// 增量静态再生
async function ISRData() {
  const data = await fetch('https://api.example.com/isr', {
    next: { revalidate: 60 }  // 60秒后重新验证
  });
  return <DataDisplay data={data.json()} />;
}
```

## 错误处理

RSC 的错误处理需要考虑服务端和客户端：

```typescript
// 服务端组件错误边界
async function UserData({ userId }) {
  try {
    const user = await db.user.findById(userId);
    if (!user) return <NotFound />;
    return <UserProfile user={user} />;
  } catch (error) {
    return <ErrorFallback error={error} />;
  }
}

// 客户端错误边界
'use client';
function ErrorBoundary({ children }) {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      {children}
    </ErrorBoundary>
  );
}
```

## 性能优化

RSC 的性能优化策略：

**策略 1：减少客户端 JavaScript**

```typescript
// 好的做法：逻辑放在服务端
async function DataDisplay() {
  const data = await fetchData();
  const processed = processData(data);  // 服务端处理
  return <Chart data={processed} />;
}

// 不好的做法：大量数据发送到客户端
'use client';
function DataDisplay({ data }) {
  const processed = processData(data);  // 客户端处理
  return <Chart data={processed} />;
}
```

**策略 2：并行数据获取**

```typescript
async function Dashboard() {
  // 并行获取，不串行
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

**策略 3：预取数据**

```typescript
// 布局中预取子页面数据
async function Layout({ children }) {
  // 预取常用数据
  const user = await getUser();
  
  return (
    <div>
      <Sidebar user={user} />
      <main>{children}</main>
    </div>
  );
}
```

## 小结

React Server Components 让数据获取变得更简单、更高效。服务端组件直接访问后端资源，客户端组件处理交互逻辑。2026 年的 RSC 实践原则：正确的组件边界、合理的缓存策略、并行数据获取。RSC 不是银弹，但它是 React 应用架构的未来方向。
