---
title: "React 19 正式版：生产环境迁移指南"
date: 2025-01-10 17:04:41
tags:
  - React
readingTime: 2
description: "React 19 正式发布了。来整理一下从 18 迁移到 19 的实际注意事项，以及团队踩过的坑。"
wordCount: 255
---

React 19 正式发布了。来整理一下从 18 迁移到 19 的实际注意事项，以及团队踩过的坑。

## 主要变化回顾

```
useActionState（之前叫 useFormState，API 改了）
useFormStatus
useOptimistic
use() hook
ref 作为 prop（forwardRef 弃用）
Context 直接用 <Context>（不需要 <Context.Provider>）
```

## 迁移：forwardRef

```tsx
// React 18：需要 forwardRef
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn("border rounded px-3 py-2", className)}
      {...props}
    />
  ),
);
Input.displayName = "Input";

// React 19：直接传 ref prop
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

function Input({ ref, className, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={cn("border rounded px-3 py-2", className)}
      {...props}
    />
  );
}
```

但注意：如果你的项目有很多用到 `forwardRef` 的组件库（比如 Radix UI、shadcn/ui），这些库会逐步更新，不需要你手动改。

## 迁移：Context

```tsx
// React 18
<ThemeContext.Provider value={theme}>
  {children}
</ThemeContext.Provider>

// React 19
<ThemeContext value={theme}>
  {children}
</ThemeContext>
```

旧写法依然有效，只是新写法更简洁。

## 迁移：useFormState → useActionState

```tsx
// React 18（react-dom）
import { useFormState } from "react-dom";
const [state, action] = useFormState(myAction, initialState);

// React 19（react）
import { useActionState } from "react";
const [state, action, isPending] = useActionState(myAction, initialState);
```

多了第三个返回值 `isPending`，不需要再单独管理 loading 状态。

## 服务端组件 + Server Actions 的生产实践

```tsx
// app/products/page.tsx（服务端组件，直接访问数据库）
import { db } from "@/lib/db";

export default async function ProductsPage() {
  // 不需要 API 路由，直接查数据库
  const products = await db.product.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return <ProductList products={products} />;
}
```

```tsx
// actions/product.ts（Server Actions）
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

export async function deleteProduct(productId: string) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    throw new Error("Unauthorized");
  }

  await db.product.delete({ where: { id: productId } });
  revalidatePath("/products");
}
```

```tsx
// 客户端组件使用 Server Action
"use client";

import { deleteProduct } from "@/actions/product";
import { useActionState } from "react";

function DeleteButton({ productId }: { productId: string }) {
  const [state, action, isPending] = useActionState(async () => {
    await deleteProduct(productId);
    return { success: true };
  }, null);

  return (
    <form action={action}>
      <button disabled={isPending}>{isPending ? "删除中..." : "删除"}</button>
    </form>
  );
}
```

## 我们团队遇到的坑

**1. Suspense 边界设置**

Server Components 配合 Suspense 时，边界位置很重要：

```tsx
// 坏的：整个页面等待一个慢查询
export default async function Page() {
  const [slowData, fastData] = await Promise.all([
    getSlowData(),
    getFastData(),
  ]);
  // ...
}

// 好的：慢的数据用 Suspense 包裹
export default function Page() {
  return (
    <div>
      <FastSection /> {/* 先渲染 */}
      <Suspense fallback={<Skeleton />}>
        <SlowSection /> {/* 异步渲染 */}
      </Suspense>
    </div>
  );
}
```

**2. Server Actions 的错误处理**

```tsx
"use server";

export async function submitForm(formData: FormData) {
  try {
    // ...
    return { success: true };
  } catch (e) {
    // 不要直接 throw Error，客户端会收到 500 页面
    // 要 return error 信息
    return { success: false, error: "操作失败，请重试" };
  }
}
```

## 小结

- React 19 迁移成本不高，大部分是向后兼容的
- `forwardRef` 弃用，但还能用，慢慢迁移就好
- `useActionState` 替代 `useFormState`，多了 isPending
- Server Components + Server Actions 是生产级的，值得在新项目里全面采用
- Suspense 边界设计是关键，要仔细规划
