---
title: "React 18 安定版：並行レンダリング詳細解説"
date: 2022-04-01 09:31:34
tags:
  - React
readingTime: 2
description: "React 18 が正式リリースされました！3年待ちに待った Concurrent 機能がようやく安定版になりました。プレビュー版と比べて正式版の API はほぼ変わっていませんが、ドキュメントとベストプラクティスがより充実しています。"
wordCount: 415
---

React 18 が正式リリースされました！3年待ちに待った Concurrent 機能がようやく安定版になりました。プレビュー版と比べて正式版の API はほぼ変わっていませんが、ドキュメントとベストプラクティスがより充実しています。

## アップグレード手順

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

この手順は必須であり、これがないと同時実行機能は有効にならない。

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

Effect が 2 回実行されるのを見つけても、ref で回避しようとしないでほしい。これは StrictMode がバグを見つけるのを助けているのだ。

## tRPC：型安全な API 層

React 18 と同時期に流行したライブラリで、フロントエンドとバックエンドの型共有の問題を解決する：

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

## まとめ

- `createRoot` が `ReactDOM.render` に代わり、すべての Concurrent 機能を有効にします
- Automatic Batching は無料で利用でき、不要な再レンダリングを削減します
- useTransition は緊急・非緊急の更新を区別し、インタラクションをスムーズに保ちます
- StrictMode で Effect が2回実行されるのは意図的な動作です。回避せず、バグを修正しましょう
- tRPC は2022年において非常に価値のある技術で、フルスタック TypeScript の最良のパートナーです