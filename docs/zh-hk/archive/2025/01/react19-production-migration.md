---
title: "React 19 正式版：生產環境遷移指南"
date: 2025-01-10 10:00:00
tags:
  - React
readingTime: 2
description: "React 19 正式發佈了。來整理一下從 18 遷移到 19 的實際注意事項，以及團隊踩過的坑。"
---

React 19 正式發佈了。來整理一下從 18 遷移到 19 的實際注意事項，以及團隊踩過的坑。

## 主要變化回顧

```
useActionState（之前叫 useFormState，API 改了）
useFormStatus
useOptimistic
use() hook
ref 作為 prop（forwardRef 棄用）
Context 直接用 <Context>（不需要 <Context.Provider>）
```

## 遷移：forwardRef

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

// React 19：直接傳 ref prop
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

但注意：如果你的項目有很多用到 `forwardRef` 的組件庫（比如 Radix UI、shadcn/ui），這些庫會逐步更新，不需要你手動改。

## 遷移：Context

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

舊寫法依然有效，只是新寫法更簡潔。

## 遷移：useFormState → useActionState

```tsx
// React 18（react-dom）
import { useFormState } from "react-dom";
const [state, action] = useFormState(myAction, initialState);

// React 19（react）
import { useActionState } from "react";
const [state, action, isPending] = useActionState(myAction, initialState);
```

多了第三個返回值 `isPending`，不需要再單獨管理 loading 狀態。

## 服務端組件 + Server Actions 的生產實踐

```tsx
// app/products/page.tsx（服務端組件，直接訪問數據庫）
import { db } from "@/lib/db";

export default async function ProductsPage() {
  // 不需要 API 路由，直接查數據庫
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
// 客户端組件使用 Server Action
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
      <button disabled={isPending}>{isPending ? "刪除中..." : "刪除"}</button>
    </form>
  );
}
```

## 我們團隊遇到的坑

**1. Suspense 邊界設置**

Server Components 配合 Suspense 時，邊界位置很重要：

```tsx
// 壞的：整個頁面等待一個慢查詢
export default async function Page() {
  const [slowData, fastData] = await Promise.all([
    getSlowData(),
    getFastData(),
  ]);
  // ...
}

// 好的：慢的數據用 Suspense 包裹
export default function Page() {
  return (
    <div>
      <FastSection /> {/* 先渲染 */}
      <Suspense fallback={<Skeleton />}>
        <SlowSection /> {/* 異步渲染 */}
      </Suspense>
    </div>
  );
}
```

**2. Server Actions 的錯誤處理**

```tsx
"use server";

export async function submitForm(formData: FormData) {
  try {
    // ...
    return { success: true };
  } catch (e) {
    // 不要直接 throw Error，客户端會收到 500 頁面
    // 要 return error 信息
    return { success: false, error: "操作失敗，請重試" };
  }
}
```

## 小結

- React 19 遷移成本不高，大部分是向後兼容的
- `forwardRef` 棄用，但還能用，慢慢遷移就好
- `useActionState` 替代 `useFormState`，多了 isPending
- Server Components + Server Actions 是生產級的，值得在新項目裏全面採用
- Suspense 邊界設計是關鍵，要仔細規劃
