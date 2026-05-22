---
title: "React 19 正式リリース：新しいHooksとServer Actionsの完全解説"
date: 2024-12-18 13:52:29
tags:
  - React
readingTime: 3
description: "React 19 が2024年12月5日に正式リリース（安定版）され、約2年間に及ぶ RC/Beta 段階が終了しました。新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正"
wordCount: 363
---

React 19 が2024年12月5日に正式リリース（安定版）され、約2年間に及ぶ RC/Beta 段階が終了しました。新版本带来了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 Document Metadata 原生支持。

## use()：Promise と Context の読み取り

`use()` は React 19 で最も特徴的な Hook です——レンダリング時に Promise の値を読み取ることができます：

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

`use()` は Context も読み取ることができ、条件文/ループ内でも使用可能です：

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

## useActionState：フォームアクション状態の管理

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

## useFormStatus：フォーム送信状態

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

## useOptimistic：楽観的更新

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

## Document Metadata ネイティブサポート

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

## React Compiler と React 19 の連携

```bash
# React 19 + React Compiler 组合（推荐）
npm install react@19 react-dom@19
npm install --save-dev babel-plugin-react-compiler
```

React 19 安定版 + React Compiler Beta は現在最も推奨される React スタックです——Compiler が手動最適化を排除し、React 19 の新しい API が非同期データフローを簡素化します。

## まとめ

React 19 は近年で最も変化の大きい React バージョンですが、方向は明確です：**非同期操作とフォーム処理をファーストクラスシチズンに昇格させる**。`useActionState` + `useFormStatus` + `useOptimistic` 三件套几乎覆盖了所有表单场景，告别了繁琐的手动状态管理。配合 React Compiler，2025 年的 React 开发体验将大幅提升。
