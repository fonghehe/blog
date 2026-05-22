---
title: "Next.js 13 App Router：重新定義全棧開發"
date: 2022-11-01 09:31:25
tags:
  - Next.js
readingTime: 2
description: "Next.js 13 釋出，最大變化是 App Router（`/app` 目錄），和 Pages Router 思路完全不同。"
wordCount: 237
---

Next.js 13 釋出，最大變化是 App Router（`/app` 目錄），和 Pages Router 思路完全不同。

## App Router vs Pages Router

```
pages/（舊）          app/（新）
├── index.tsx         ├── page.tsx        ← 頁面元件
├── about.tsx         ├── about/
├── api/              │   └── page.tsx
│   └── users.ts      ├── layout.tsx      ← 佈局（新概念）
└── _layout.tsx       ├── loading.tsx     ← 載入狀態（新概念）
                      ├── error.tsx       ← 錯誤邊界（新概念）
                      └── api/
                          └── users/
                              └── route.ts ← API 路由
```

## Server Components（核心變化）

```tsx
// app/users/page.tsx
// 預設是 Server Component（服務端執行，不打包到客戶端）
async function UsersPage() {
  // 直接 async/await，不需要 getServerSideProps
  const users = await db.user.findMany(); // 直接訪問資料庫！

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
// "use client" 宣告客戶端元件（有互動、有 hooks）
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

**關鍵原則：Server Component 可以包含 Client Component，但反過來不行。**

## layout.tsx：巢狀佈局

```tsx
// app/layout.tsx（根佈局）
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

// app/dashboard/layout.tsx（巢狀佈局）
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
// 訪問 /dashboard/settings：RootLayout → DashboardLayout → SettingsPage
```

## 資料獲取新方式

```tsx
// 擴充套件 fetch：自動快取
async function getData() {
  // 預設快取（靜態生成）
  const staticData = await fetch("https://api.example.com/posts");

  // 每次請求重新獲取（服務端渲染）
  const dynamicData = await fetch("https://api.example.com/users", {
    cache: "no-store",
  });

  // 60 秒重新驗證（增量靜態再生成）
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

## 我的評價

App Router 是思路層面的革命：Server Components + streaming 讓"服務端優先"成為可能。

但 2022 年 11 月剛釋出時還不成熟：

- 文件不完善
- 很多第三方庫不支援 Server Components
- 除錯複雜（server/client 邊界不容易理解）

建議：新專案可以開始用，老專案等 6 個月生態穩定再遷移。

## 小結

- App Router 預設 Server Components：直接 async/await，不打包到客戶端
- `'use client'` 宣告需要互動和 hooks 的元件
- `layout.tsx` 巢狀佈局，比 `_app.js` 更靈活
- fetch 擴充套件了快取控製，三種策略（靜態/動態/增量再生成）