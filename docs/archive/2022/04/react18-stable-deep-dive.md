---
title: "React 18 正式版：并发渲染深度解析"
date: 2022-04-01 09:31:34
tags:
  - React
---

React 18 正式发布了！等了 3 年的 Concurrent 特性终于稳定。和之前的预览版相比，正式版 API 基本没变，但文档和最佳实践更完善了。

## 升级步骤

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

这一步是必须的，否则并发特性不会开启。

## Automatic Batching 的实际效果

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

## useTransition 生产实践

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

## 新的 Strict Mode 行为

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

如果发现 Effect 执行了两次，不要加 ref 去绕过，这是 StrictMode 在帮你找 bug。

## tRPC：类型安全的 API 层

和 React 18 同期流行起来的库，解决了前后端类型共享的问题：

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

## 小结

- `createRoot` 替换 `ReactDOM.render`，开启所有并发特性
- Automatic Batching 免费获得，减少不必要的渲染
- useTransition 区分紧急/非紧急更新，保持交互流畅
- StrictMode 下 Effect 执行两次是故意的，别绕过，修复 bug
- tRPC 是 2022 年很有价值的技术，全栈 TypeScript 的最佳搭档