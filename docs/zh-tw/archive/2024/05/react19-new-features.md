---
title: "React 19 新特性：Actions 和 Server Components 成熟"
date: 2024-05-01 09:31:07
tags:
  - React
readingTime: 2
description: "React 19 Beta 釋出，看來正式版很快了。整理一下主要新特性。"
---

React 19 Beta 釋出，看來正式版很快了。整理一下主要新特性。

## Actions：簡化資料變更

以前 React 的資料變更流程很繁瑣：

```tsx
// React 18：手動管理 loading/error
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
      <button disabled={isPending}>{isPending ? "儲存中..." : "儲存"}</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

```tsx
// React 19：useActionState 簡化這個模式
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
      <button disabled={isPending}>{isPending ? "儲存中..." : "儲存"}</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

注意：`form` 的 `action` 現在可以接受函式！

## useFormStatus

```tsx
function SubmitButton() {
  // 獲取父表單的提交狀態（不需要 prop drilling）
  const { pending } = useFormStatus();

  return <button disabled={pending}>{pending ? "提交中..." : "提交"}</button>;
}

function Form() {
  return (
    <form action={someAction}>
      <input name="email" />
      <SubmitButton /> {/* 自動感知表單狀態 */}
    </form>
  );
}
```

## useOptimistic：樂觀更新

```tsx
function TodoList({ todos }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }],
  );

  async function addTodo(formData: FormData) {
    const text = formData.get("text") as string;

    // 立即更新 UI（樂觀）
    addOptimisticTodo({ id: Date.now(), text, done: false });

    // 後臺非同步儲存
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
        <button>新增</button>
      </form>
    </div>
  );
}
```

## use()：通用的資源讀取

```tsx
import { use, Suspense } from "react";

// 接受 Promise（比 await 更靈活，可以在條件分支裡用）
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // 如果 Promise 未完成，丟擲 Promise（Suspense 接住）
  return <div>{user.name}</div>;
}

function App() {
  const userPromise = fetchUser(userId); // 在元件外發起請求（不阻塞渲染）

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// 也可以讀 Context（比 useContext 更靈活，可以在條件語句裡用）
const theme = use(ThemeContext);
```

## ref 作為 prop

```tsx
// React 19 之前：需要 forwardRef
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
));

// React 19：直接傳 ref
function Input({
  ref,
  ...props
}: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// 使用
<Input ref={inputRef} />;
```

## Server Components 成熟

React 19 配合 Next.js 15，Server Components 的邊界更清晰：

```tsx
// 資料獲取在服務端
async function ProductPage({ id }: { id: string }) {
  const product = await getProduct(id); // 服務端直接訪問資料

  return (
    <div>
      <h1>{product.name}</h1>
      <ProductGallery images={product.images} /> {/* Server Component */}
      <AddToCart productId={id} /> {/* 'use client' 元件 */}
    </div>
  );
}
```

## 小結

- `useActionState`：簡化表單提交的 pending/error 管理
- `useFormStatus`：子元件感知父表單狀態，不用 prop drilling
- `useOptimistic`：內建樂觀更新模式
- `use()`：通用資源讀取，可在條件語句中使用
- ref 可以直接作為 prop 傳遞，不再需要 forwardRef