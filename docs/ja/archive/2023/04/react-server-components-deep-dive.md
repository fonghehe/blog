---
title: "React Server Components：フロントエンドとバックエンドの境界を再定義"
date: 2023-04-10 15:28:50
tags:
  - React
  - TypeScript
readingTime: 3
description: "React Server Components（RSC）は、単なるもう一つの SSR ソリューションではありません。これは React チームによる「コンポーネントはどこで実行されるべきか」という問いに対する全く新しい答えです。"
wordCount: 770
---

React Server Components（RSC）は、単なるもう一つの SSR ソリューションではありません。React チームによる「コンポーネントはどこで実行されるべきか」という問いに対する全く新しい答えです。

## SSR vs RSC

従来の SSR：サーバーサイドで HTML をレンダリングし、クライアントで完全な React コンポーネントツリーにハイドレートします。すべてのコンポーネントがクライアントバンドルに含まれます。

RSC：コンポーネントはサーバーサイドでのみ実行され、クライアントバンドルには含まれません。クライアントはレンダリング結果（特殊な JSON 形式）のみを受け取ります。

```
传统 SSR:
  Server: 渲染 HTML -> Client: 下载 JS -> Client: Hydrate 所有组件

RSC:
  Server: RSC 组件执行 -> 输出 RSC Payload -> Client: 只 hydrate Client 组件
```

## Server Component vs Client Component

```typescript
// デフォルトは Server Component
// app/posts/page.tsx（Next.js 14）

async function PostList() {
  // データベースに直接アクセスし、API は不要
  const posts = await db.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
          {/* Server Component の中に Client Component をネストできる */}
          <LikeButton postId={post.id} initialCount={post.likes} />
        </article>
      ))}
    </div>
  );
}

export default PostList;
```

```typescript
// インタラクションが必要なコンポーネントは 'use client' でマーク
"use client";

import { useState } from "react";

interface LikeButtonProps {
  postId: string;
  initialCount: number;
}

export function LikeButton({ postId, initialCount }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);

  const handleLike = async () => {
    setLiked(true);
    setCount((c) => c + 1);
    await fetch(`/api/posts/${postId}/like`, { method: "POST" });
  };

  return (
    <button onClick={handleLike} disabled={liked}>
      {liked ? "已点赞" : "点赞"} ({count})
    </button>
  );
}
```

基本原則：**デフォルトは Server Component で、`useState`/`useEffect`/イベント処理が必要な場合のみ `'use client'` を追加します**。

## データフェッチパターンの変革

```typescript
// 従来のパターン：クライアントサイドで取得
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser);
  }, [userId]);
  // loading state、error state、waterfall...
}

// RSC パターン：サーバーサイドで直接取得
async function UserProfile({ userId }: { userId: string }) {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) notFound();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
      <Suspense fallback={<FollowersSkeleton />}>
        <Followers userId={userId} />
      </Suspense>
    </div>
  );
}
```

`useEffect` は不要、loading 状態の管理は不要、ウォーターフォールも発生しません。データはサーバーサイドで準備され、直接レンダリングされます。

## 実際のアーキテクチャの考え方

**Server Component を使用するケース：**
- 純粋な表示のみで、インタラクションが不要なコンポーネント
- データ取得ロジック
- バックエンドリソースへのアクセス（データベース、ファイルシステム、内部サービス）
- 機密操作（トークンや秘密鍵をクライアントに公開しない）

**Client Component を使用するケース：**
- `useState`、`useEffect` を使用する
- イベント処理（onClick、onChange）がある
- ブラウザ API を使用する
- context を必要とするコンポーネント

**境界原則：** Client Component は可能な限り小さく、できるだけリーフノードに配置します。コンポーネントツリーの大部分は Server Component であるべきです。

## まとめ

- RSC は SSR の代替ではなく、全く新しいコンポーネントモデルです
- デフォルトは Server Component で、インタラクションが必要な場合のみ `'use client'` をマークします
- 従来のデータ取得における loading/waterfall の問題を解消します
- サーバーサイドのロジックがクライアントに公開されず、セキュリティとバンドルサイズの両方でメリットがあります
- メンタルモデルの変革が必要です：「すべてのコンポーネントがクライアント」から「必要に応じて実行環境を選択」へ
