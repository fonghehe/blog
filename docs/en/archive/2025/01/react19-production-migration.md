---
title: "React 19 Official Release: Production Migration Guide"
date: 2025-01-10 17:04:41
tags:
  - React
readingTime: 2
description: "React 19 is officially released. Here's a roundup of practical notes for migrating from 18 to 19, including pitfalls our team encountered."
wordCount: 171
---

React 19 is officially released. Here's a roundup of practical notes for migrating from 18 to 19, including pitfalls our team encountered.

## Key Changes Overview

```
useActionState (previously called useFormState — the API changed)
useFormStatus
useOptimistic
use() hook
ref as a prop (forwardRef deprecated)
Context used directly as <Context> (no more need for <Context.Provider>)
```

## Migration: forwardRef

```tsx
// React 18: forwardRef was required
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

// React 19: pass ref directly as a prop
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

Note: if your project uses component libraries that depend on `forwardRef` (e.g., Radix UI, shadcn/ui), those libraries will gradually update — you don't need to migrate manually.

## Migration: Context

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

The old syntax still works; the new syntax is just cleaner.

## Migration: useFormState → useActionState

```tsx
// React 18 (react-dom)
import { useFormState } from "react-dom";
const [state, action] = useFormState(myAction, initialState);

// React 19 (react)
import { useActionState } from "react";
const [state, action, isPending] = useActionState(myAction, initialState);
```

There's now a third return value `isPending`, so you no longer need to manage loading state separately.

## Server Components + Server Actions in Production

```tsx
// app/products/page.tsx (Server Component, direct database access)
import { db } from "@/lib/db";

export default async function ProductsPage() {
  // No API route needed — query the database directly
  const products = await db.product.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
  });

  return <ProductList products={products} />;
}
```

```tsx
// actions/product.ts (Server Actions)
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
// Client component using a Server Action
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

## Pitfalls Our Team Encountered

**1. Suspense Boundary Placement**

When combining Server Components with Suspense, the boundary position matters:

```tsx
// Bad: the entire page waits for one slow query
export default async function Page() {
  const [slowData, fastData] = await Promise.all([
    getSlowData(),
    getFastData(),
  ]);
  // ...
}

// Good: wrap slow data in Suspense
export default function Page() {
  return (
    <div>
      <FastSection /> {/* renders first */}
      <Suspense fallback={<Skeleton />}>
        <SlowSection /> {/* renders asynchronously */}
      </Suspense>
    </div>
  );
}
```

**2. Error Handling in Server Actions**

```tsx
"use server";

export async function submitForm(formData: FormData) {
  try {
    // ...
    return { success: true };
  } catch (e) {
    // Don't throw an Error directly — the client will receive a 500 page
    // Instead, return error information
    return { success: false, error: "操作失败，请重试" };
  }
}
```

## Summary

- React 19 migration cost is low; most changes are backward-compatible
- `forwardRef` is deprecated but still works — migrate gradually
- `useActionState` replaces `useFormState`, adding `isPending` as a third return value
- Server Components + Server Actions are production-ready and worth adopting fully in new projects
- Suspense boundary design is critical — plan carefully
