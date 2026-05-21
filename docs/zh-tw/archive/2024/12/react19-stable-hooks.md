---
title: "React 19 正式釋出：全新 Hooks 與 Server Actions 完整解析"
date: 2024-12-18 10:00:00
tags:
  - React
readingTime: 2
description: "React 19 於 2024 年 12 月 5 日正式釋出（穩定版），結束了長達近兩年的 RC/Beta 階段。新版本帶來了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 "
wordCount: 267
---

React 19 於 2024 年 12 月 5 日正式釋出（穩定版），結束了長達近兩年的 RC/Beta 階段。新版本帶來了 `use()`、`useActionState()`、`useFormStatus()`、`useOptimistic()` 等全新 Hook，以及 Server Actions 的正式化和 Document Metadata 原生支援。

## use()：讀取 Promise 和 Context

`use()` 是 React 19 最特別的 Hook——它可以在渲染時讀取 Promise 的值：

```tsx
import { use, Suspense } from "react";

// 資料獲取函式（返回 Promise）
async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

// 在元件中使用 use() 讀取 Promise
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // 掛起直到 Promise resolve
  return <div>{user.name}</div>;
}

// 父元件：在渲染外建立 Promise（避免每次渲染重新建立）
function App() {
  const userPromise = useMemo(() => fetchUser("123"), []);

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

`use()` 也可以讀取 Context，且可以在條件/迴圈中使用：

```tsx
function ConditionalTheme({ enabled }: { enabled: boolean }) {
  // ✅ use() 可以在條件中使用（普通 Hook 不行）
  if (enabled) {
    const theme = use(ThemeContext);
    return <div style={{ color: theme.primary }}>...</div>;
  }
  return null;
}
```

## useActionState：處理表單 Action 狀態

```tsx
import { useActionState } from "react";

async function submitForm(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get("name") as string;
  if (!name) return { error: "姓名不能為空", success: false };

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

## useFormStatus：表單提交狀態

```tsx
import { useFormStatus } from "react-dom";

// SubmitButton 必須是 form 的子元件才能訪問狀態
function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending, data, method } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "處理中..." : children}
    </button>
  );
}

function LoginForm() {
  return (
    <form action={loginAction}>
      <input name="email" type="email" />
      <input name="password" type="password" />
      <SubmitButton>登入</SubmitButton> {/* SubmitButton 自動感知 form 狀態 */}
    </form>
  );
}
```

## useOptimistic：樂觀更新

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

    addOptimisticMessage(tempMsg); // 立即顯示（樂觀）

    await fetch("/api/messages", {
      // 實際傳送
      method: "POST",
      body: JSON.stringify({ text }),
    });
    // 傳送完成後，React 用真實資料替換樂觀資料
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
        <button type="submit">傳送</button>
      </form>
    </>
  );
}
```

## Document Metadata 原生支援

```tsx
// React 19 原生支援 <title>、<meta>、<link> 在元件中宣告
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
// React 自動將這些標籤提升到 <head>，無需 react-helmet 等第三方庫
```

## React Compiler 配合 React 19

```bash
# React 19 + React Compiler 組合（推薦）
npm install react@19 react-dom@19
npm install --save-dev babel-plugin-react-compiler
```

React 19 正式版 + React Compiler Beta 是目前最推薦的 React 技術棧——Compiler 消除手動最佳化，React 19 的新 API 簡化非同步資料流。

## 總結

React 19 是 React 最近幾年變化最大的版本，但方向很清晰：**將非同步操作和表單處理提升為一等公民**。`useActionState` + `useFormStatus` + `useOptimistic` 三件套幾乎覆蓋了所有表單場景，告別了繁瑣的手動狀態管理。配合 React Compiler，2025 年的 React 開發體驗將大幅提升。
