---
title: "Next.js 13 App Router：重新定义全栈开发"
date: 2022-11-01 09:31:25
tags:
  - Next.js
readingTime: 2
description: "Next.js 13 发布，最大变化是 App Router（`/app` 目录），和 Pages Router 思路完全不同。"
wordCount: 235
---

Next.js 13 发布，最大变化是 App Router（`/app` 目录），和 Pages Router 思路完全不同。

## App Router vs Pages Router

```
pages/（旧）          app/（新）
├── index.tsx         ├── page.tsx        ← 页面组件
├── about.tsx         ├── about/
├── api/              │   └── page.tsx
│   └── users.ts      ├── layout.tsx      ← 布局（新概念）
└── _layout.tsx       ├── loading.tsx     ← 加载状态（新概念）
                      ├── error.tsx       ← 错误边界（新概念）
                      └── api/
                          └── users/
                              └── route.ts ← API 路由
```

## Server Components（核心变化）

```tsx
// app/users/page.tsx
// 默认是 Server Component（服务端执行，不打包到客户端）
async function UsersPage() {
  // 直接 async/await，不需要 getServerSideProps
  const users = await db.user.findMany(); // 直接访问数据库！

  return (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

export default UsersPage;
```

```tsx
// app/users/UserCard.tsx
// "use client" 声明客户端组件（有交互、有 hooks）
"use client";

import { useState } from "react";

export function UserCard({ user }: { user: User }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div onClick={() => setIsExpanded(!isExpanded)}>
      <h2>{user.name}</h2>
      {isExpanded && <p>{user.bio}</p>}
    </div>
  );
}
```

**关键原则：Server Component 可以包含 Client Component，但反过来不行。**

## layout.tsx：嵌套布局

```tsx
// app/layout.tsx（根布局）
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Navigation />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

// app/dashboard/layout.tsx（嵌套布局）
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
// 访问 /dashboard/settings：RootLayout → DashboardLayout → SettingsPage
```

## 数据获取新方式

```tsx
// 扩展 fetch：自动缓存
async function getData() {
  // 默认缓存（静态生成）
  const staticData = await fetch("https://api.example.com/posts");

  // 每次请求重新获取（服务端渲染）
  const dynamicData = await fetch("https://api.example.com/users", {
    cache: "no-store",
  });

  // 60 秒重新验证（增量静态再生成）
  const revalidatedData = await fetch("https://api.example.com/config", {
    next: { revalidate: 60 },
  });
}
```

## Route Handlers（API 路由）

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page")) || 1;

  const users = await db.user.findMany({
    skip: (page - 1) * 20,
    take: 20,
  });

  return NextResponse.json({ users, page });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const user = await db.user.create({ data: body });
  return NextResponse.json(user, { status: 201 });
}
```

## Metadata API（SEO）

```tsx
// app/products/[id]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);

  return {
    title: product.name,
    description: product.description,
    openGraph: {
      images: [{ url: product.image }],
    },
  };
}
```

## 我的评价

App Router 是思路层面的革命：Server Components + streaming 让"服务端优先"成为可能。

但 2022 年 11 月刚发布时还不成熟：

- 文档不完善
- 很多第三方库不支持 Server Components
- 调试复杂（server/client 边界不容易理解）

建议：新项目可以开始用，老项目等 6 个月生态稳定再迁移。

## 小结

- App Router 默认 Server Components：直接 async/await，不打包到客户端
- `'use client'` 声明需要交互和 hooks 的组件
- `layout.tsx` 嵌套布局，比 `_app.js` 更灵活
- fetch 扩展了缓存控制，三种策略（静态/动态/增量再生成）