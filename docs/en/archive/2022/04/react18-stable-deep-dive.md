---
title: "React 18 Stable Release: Concurrent Rendering Deep Dive"
date: 2022-04-01 09:31:34
tags:
  - React
readingTime: 2
description: "React 18 is officially released! The Concurrent features we've been waiting three years for are finally stable. Compared to the preview releases, the APIs haven't changed much, but the documentation and best practices are more complete."
wordCount: 159
---

React 18 is officially released! The Concurrent features we've been waiting three years for are finally stable. Compared to the preview releases, the APIs haven't changed much, but the documentation and best practices are more complete.

## Upgrade Steps

```bash
npm install react@18 react-dom@18
```

```javascript
// Before
import ReactDOM from "react-dom";
ReactDOM.render(<App />, document.getElementById("root"));

// After
import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root"));
root.render(<App />);
```

This step is required; otherwise concurrent features won't be enabled.

## Automatic Batching in Practice

```javascript
// 这个在 React 17 中会触发 3 次渲染，React 18 只触发 1 次
async function handleSave() {
  const result = await api.save(data);

  // React 17：每次 setState 都触发渲染
  setData(result);
  setLoading(false);
  setError(null);

  // React 18：这三次 setState 批处理，只渲染一次
}

// 如果你需要强制不批处理（特殊情况）
import { flushSync } from "react-dom";

flushSync(() => setLoading(false)); // 立即渲染
setData(result); // 再渲染
```

## useTransition in Production

```typescript
function TabPanel() {
  const [tab, setTab] = useState('posts')
  const [isPending, startTransition] = useTransition()

  function selectTab(nextTab: string) {
    startTransition(() => {
      setTab(nextTab)
    })
  }

  return (
    <div>
      <TabBar
        onSelect={selectTab}
        pending={isPending}  // 可以用来显示一个微妙的加载状态
      />

      {/* tab 切换有卡顿时不会阻塞 TabBar 的点击响应 */}
      <Suspense fallback={<Spinner />}>
        {tab === 'posts' && <PostsList />}
        {tab === 'comments' && <CommentsList />}
      </Suspense>
    </div>
  )
}
```

## New Strict Mode Behavior

```javascript
// React 18 StrictMode：Effect 会执行两次（mount → unmount → mount）
// 目的：验证 Effect 的 cleanup 函数是否正确实现

useEffect(() => {
  const subscription = setupSubscription();

  return () => {
    // 这个 cleanup 在开发模式会被调用一次"假的" unmount
    // 确保你的 cleanup 是正确的
    subscription.unsubscribe();
  };
}, []);
```

If you notice Effects running twice, don't add a ref to work around it — StrictMode is helping you find bugs.

## tRPC: Type-Safe API Layer

A library that gained popularity around the same time as React 18, solving the problem of sharing types between frontend and backend:

```typescript
// server/router.ts（后端）
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

export const appRouter = t.router({
  getUser: t.procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.user.findUnique({ where: { id: input.id } });
    }),

  createPost: t.procedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await db.post.create({ data: { ...input, authorId: ctx.userId } });
    }),
});

export type AppRouter = typeof appRouter;
```

```typescript
// client/App.tsx（前端）
import { trpc } from './trpc'

function UserProfile({ userId }: { userId: number }) {
  // 类型完全推导，不需要手写 API 类型
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId })
  //         ↑ 自动推导为 { id: number; name: string; email: string } | null

  const mutation = trpc.createPost.useMutation({
    onSuccess: () => router.push('/posts')
  })

  return <div>{user?.name}</div>
}
```

## Summary

- `createRoot` replaces `ReactDOM.render`, enabling all concurrent features
- Automatic Batching comes for free, reducing unnecessary re-renders
- useTransition separates urgent from non-urgent updates, keeping interactions smooth
- Effects running twice under StrictMode is intentional — don't work around it, fix the bug
- tRPC was a high-value technology in 2022, the best companion for full-stack TypeScript