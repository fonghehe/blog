---
title: "React 18 正式版：併發渲染深度解析"
date: 2022-04-01 09:31:34
tags:
  - React
readingTime: 2
description: "React 18 正式釋出了！等了 3 年的 Concurrent 特性終於穩定。和之前的預覽版相比，正式版 API 基本沒變，但檔案和最佳實踐更完善了。"
wordCount: 235
---

React 18 正式釋出了！等了 3 年的 Concurrent 特性終於穩定。和之前的預覽版相比，正式版 API 基本沒變，但文件和最佳實踐更完善了。

## 升級步驟

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

這一步是必須的，否則併發特性不會開啟。

## Automatic Batching 的實際效果

```javascript
// 這個在 React 17 中會觸發 3 次渲染，React 18 隻觸發 1 次
async function handleSave() {
  const result = await api.save(data);

  // React 17：每次 setState 都觸發渲染
  setData(result);
  setLoading(false);
  setError(null);

  // React 18：這三次 setState 批處理，隻渲染一次
}

// 如果你需要強製不批處理（特殊情況）
import { flushSync } from "react-dom";

flushSync(() => setLoading(false)); // 立即渲染
setData(result); // 再渲染
```

## useTransition 生產實踐

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
        pending={isPending}  // 可以用來顯示一個微妙的載入狀態
      />

      {/* tab 切換有卡頓時不會阻塞 TabBar 的點選響應 */}
      <Suspense fallback={<Spinner />}>
        {tab === 'posts' && <PostsList />}
        {tab === 'comments' && <CommentsList />}
      </Suspense>
    </div>
  )
}
```

## 新的 Strict Mode 行為

```javascript
// React 18 StrictMode：Effect 會執行兩次（mount → unmount → mount）
// 目的：驗證 Effect 的 cleanup 函式是否正確實現

useEffect(() => {
  const subscription = setupSubscription();

  return () => {
    // 這個 cleanup 在開發模式會被呼叫一次"假的" unmount
    // 確保你的 cleanup 是正確的
    subscription.unsubscribe();
  };
}, []);
```

如果發現 Effect 執行了兩次，不要加 ref 去繞過，這是 StrictMode 在幫你找 bug。

## tRPC：型別安全的 API 層

和 React 18 同期流行起來的庫，解決了前後端型別共享的問題：

```typescript
// server/router.ts（後端）
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
  // 型別完全推導，不需要手寫 API 型別
  const { data: user, isLoading } = trpc.getUser.useQuery({ id: userId })
  //         ↑ 自動推導為 { id: number; name: string; email: string } | null

  const mutation = trpc.createPost.useMutation({
    onSuccess: () => router.push('/posts')
  })

  return <div>{user?.name}</div>
}
```

## 小結

- `createRoot` 替換 `ReactDOM.render`，開啟所有併發特性
- Automatic Batching 免費獲得，減少不必要的渲染
- useTransition 區分緊急/非緊急更新，保持互動流暢
- StrictMode 下 Effect 執行兩次是故意的，別繞過，修復 bug
- tRPC 是 2022 年很有價值的技術，全棧 TypeScript 的最佳搭檔