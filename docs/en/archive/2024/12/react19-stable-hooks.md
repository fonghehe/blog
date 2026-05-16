---
title: "React 19 Official Release: New Hooks and Server Actions Complete Analysis"
date: 2024-12-18 10:00:00
tags:
  - React
readingTime: 2
description: "React 19 officially launched on December 5, 2024 (stable release), ending nearly two years of RC/Beta phase.新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、"
---

React 19 officially launched on December 5, 2024 (stable release), ending nearly two years of RC/Beta phase.新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 Document Metadata 原生支持。

## use(): Reading Promises and Context

`use()` is React 19's most distinctive Hook — it can read the value of a Promise at render time:

```tsx
import { use, Suspense } from "react";

// 数据获取函数（返回 Promise）
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// 在组件中使用 use() 读取 Promise
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // 挂起直到 Promise resolve
  return <div>{user.name}</div>;
}

// 父组件：在渲染外创建 Promise（避免每次渲染重新创建）
function App() {
  const userPromise = useMemo(() => fetchUser("123"), []);

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

`use()` can also read Context and can be used inside conditionals/loops:

```tsx
function ConditionalTheme({ enabled }: { enabled: boolean }) {
  // ✅ use() 可以在条件中使用（普通 Hook 不行）
  if (enabled) {
    const theme = use(ThemeContext);
    return <div style={{ color: theme.primary }}>...</div>;
  }
  return null;
}
```

## useActionState: Handling Form Action State

```tsx
import { useActionState } from "react";

async function submitForm(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get("name") as string;
  if (!name) return { error: "姓名不能为空", success: false };

  await saveUser({ name });
  return { error: null, success: true, name };
}

function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction}>
      <input name="name" disabled={isPending} />
      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">提交成功！</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "提交中..." : "提交"}
      </button>
    </form>
  );
}
```

## useFormStatus: Form Submission State

```tsx
import { useFormStatus } from "react-dom";

// SubmitButton 必须是 form 的子组件才能访问状态
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending, data, method } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "处理中..." : children}
    </button>
  );
}

function LoginForm() {
  return (
    <form action={loginAction}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <SubmitButton>登录</SubmitButton> {/* SubmitButton 自动感知 form 状态 */}
    </form>
  );
}
```

## useOptimistic: Optimistic Updates

```tsx
import { useOptimistic } from "react";

function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage: Message) => [
      ...state,
      { ...newMessage, sending: true },
    ],
  );

  async function sendMessage(formData: FormData) {
    const text = formData.get("text") as string;
    const tempMsg = { id: Date.now(), text, sending: true };

    addOptimisticMessage(tempMsg); // 立即显示（乐观）

    await fetch("/api/messages", {
      // 实际发送
      method: "POST",
      body: JSON.stringify({ text }),
    });
    // 发送完成后，React 用真实数据替换乐观数据
  }

  return (
    <>
      <ul>
        {optimisticMessages.map((msg) => (
          <li key={msg.id} style={{ opacity: msg.sending ? 0.6 : 1 }}>
            {msg.text}
          </li>
        ))}
      </ul>
      <form action={sendMessage}>
        <input name="text" />
        <button type="submit">发送</button>
      </form>
    </>
  );
}
```

## Native Document Metadata Support

```tsx
// React 19 原生支持 <title>、<meta>、<link> 在组件中声明
function ProductPage({ product }: { product: Product }) {
  return (
    <>
      <title>{product.name} - 我的商店</title>
      <meta name="description" content={product.description} />
      <link rel="canonical" href={`https://shop.com/products/${product.id}`} />

      <main>
        <h1>{product.name}</h1>
        {/* ... */}
      </main>
    </>
  );
}
// React 自动将这些标签提升到 <head>，无需 react-helmet 等第三方库
```

## React Compiler with React 19

```bash
# React 19 + React Compiler 组合（推荐）
npm install react@19 react-dom@19
npm install --save-dev babel-plugin-react-compiler
```

React 19 stable + React Compiler Beta is the most recommended React stack right now — the Compiler eliminates manual optimization, and React 19's new APIs simplify async data flow.

## Summary

React 19 is the most changed React version in recent years, but the direction is clear: **elevating async operations and form handling to first-class citizens**.`useActionState` + `useFormStatus` + `useOptimistic` 三件套几乎覆盖了所有表单场景，告别了繁琐的手动状态管理。配合 React Compiler，2025 年的 React 开发体验将大幅提升。
