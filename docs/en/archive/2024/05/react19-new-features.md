---
title: "React 19 New Features: Actions and Mature Server Components"
date: 2024-05-01 09:31:07
tags:
  - React
readingTime: 2
description: "React 19 Beta has been released — the stable version appears to be just around the corner. Here is a summary of the main new features."
wordCount: 118
---

React 19 Beta has been released — the stable version appears to be just around the corner. Here is a summary of the main new features.

## Actions: Simplifying Data Mutations

Previously, React's data mutation flow was cumbersome:

```tsx
// React 18：手动管理 loading/error
function UpdateProfile() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      await updateProfile(formData);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" />
      <button disabled={isPending}>{isPending ? "保存中..." : "保存"}</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

```tsx
// React 19：useActionState 简化这个模式
import { useActionState } from "react";

async function updateProfileAction(prevState: any, formData: FormData) {
  try {
    await updateProfile(formData);
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
}

function UpdateProfile() {
  const [state, submitAction, isPending] = useActionState(
    updateProfileAction,
    null,
  );

  return (
    <form action={submitAction}>
      <input name="name" />
      <button disabled={isPending}>{isPending ? "保存中..." : "保存"}</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

Note: `form`'s `action` can now accept a function!

## useFormStatus

```tsx
function SubmitButton() {
  // 获取父表单的提交状态（不需要 prop drilling）
  const { pending } = useFormStatus();

  return <button disabled={pending}>{pending ? "提交中..." : "提交"}</button>;
}

function Form() {
  return (
    <form action={someAction}>
      <input name="email" />
      <SubmitButton /> {/* 自动感知表单状态 */}
    </form>
  );
}
```

## useOptimistic: Optimistic Updates

```tsx
function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }],
  );

  async function addTodo(formData: FormData) {
    const text = formData.get("text") as string;

    // 立即更新 UI（乐观）
    addOptimisticTodo({ id: Date.now(), text, done: false });

    // 后台异步保存
    await saveTodo({ text });
  }

  return (
    <div>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} className={todo.pending ? "opacity-50" : ""}>
            {todo.text}
          </li>
        ))}
      </ul>
      <form action={addTodo}>
        <input name="text" />
        <button>添加</button>
      </form>
    </div>
  );
}
```

## use(): Universal Resource Reading

```tsx
import { use, Suspense } from "react";

// 接受 Promise（比 await 更灵活，可以在条件分支里用）
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // 如果 Promise 未完成，抛出 Promise（Suspense 接住）
  return <div>{user.name}</div>;
}

function App() {
  const userPromise = fetchUser(userId); // 在组件外发起请求（不阻塞渲染）

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// 也可以读 Context（比 useContext 更灵活，可以在条件语句里用）
const theme = use(ThemeContext);
```

## ref as a Prop

```tsx
// React 19 之前：需要 forwardRef
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));

// React 19：直接传 ref
function Input({
  ref,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// 使用
<Input ref={inputRef} />;
```

## Server Components Matured

React 19 配合 Next.js 15，Server Components 的边界更清晰：

```tsx
// 数据获取在服务端
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id); // 服务端直接访问数据

  return (
    <div>
      <h1>{product.name}</h1>
      <ProductGallery images={product.images} /> {/* Server Component */}
      <AddToCart productId={id} /> {/* 'use client' 组件 */}
    </div>
  );
}
```

## Summary

- `useActionState`: simplifies pending/error management for form submissions
- `useFormStatus`: child components can sense parent form state without prop drilling
- `useOptimistic`: built-in optimistic update pattern
- `use()`: universal resource reading, usable inside conditional statements
- ref can be passed directly as a prop, no longer requiring forwardRef