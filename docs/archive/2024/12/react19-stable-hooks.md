---
title: "React 19 正式发布：全新 Hooks 与 Server Actions 完整解析"
date: 2024-12-18 13:52:29
tags:
  - React
readingTime: 2
description: "React 19 于 2024 年 12 月 5 日正式发布（稳定版），结束了长达近两年的 RC/Beta 阶段。新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 "
wordCount: 264
---

React 19 于 2024 年 12 月 5 日正式发布（稳定版），结束了长达近两年的 RC/Beta 阶段。新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 Document Metadata 原生支持。

## use()：读取 Promise 和 Context

`use()` 是 React 19 最特别的 Hook——它可以在渲染时读取 Promise 的值：

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

`use()` 也可以读取 Context，且可以在条件/循环中使用：

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

## useActionState：处理表单 Action 状态

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

## useFormStatus：表单提交状态

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

## useOptimistic：乐观更新

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

## Document Metadata 原生支持

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

## React Compiler 配合 React 19

```bash
# React 19 + React Compiler 组合（推荐）
npm install react@19 react-dom@19
npm install --save-dev babel-plugin-react-compiler
```

React 19 正式版 + React Compiler Beta 是目前最推荐的 React 技术栈——Compiler 消除手动优化，React 19 的新 API 简化异步数据流。

## 总结

React 19 是 React 最近几年变化最大的版本，但方向很清晰：**将异步操作和表单处理提升为一等公民**。`useActionState` + `useFormStatus` + `useOptimistic` 三件套几乎覆盖了所有表单场景，告别了繁琐的手动状态管理。配合 React Compiler，2025 年的 React 开发体验将大幅提升。
