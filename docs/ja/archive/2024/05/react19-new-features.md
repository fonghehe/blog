---
title: "React 19 新機能：Actions と成熟した Server Components"
date: 2024-05-01 09:31:07
tags:
  - React
readingTime: 2
description: "React 19 Beta がリリースされました。正式版も間もなくのようです。主要な新機能をまとめます。"
wordCount: 245
---

React 19 Beta がリリースされました。正式版も間もなくのようです。主要な新機能をまとめます。

## Actions：データ変更の簡略化

以前は React のデータ変更フローが面倒でした：

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

注意：`form` の `action` が関数を受け入れられるようになりました！

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

## useOptimistic：楽観的更新

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

## use()：汎用リソース読み取り

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

## ref を prop として渡す

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

## Server Components の成熟

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

## まとめ

- `useActionState`：フォーム送信の pending/error 管理を簡略化
- `useFormStatus`：子コンポーネントが prop drilling なしで親フォームの状態を感知
- `useOptimistic`：組み込みの楽観的更新パターン
- `use()`：条件文の中でも使えるユニバーサルなリソース読み取り
- ref を prop として直接渡せるようになり、forwardRef が不要に