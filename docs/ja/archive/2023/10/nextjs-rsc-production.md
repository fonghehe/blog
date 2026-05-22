---
title: "Next.js 14 App Router：RSC 本番環境実践"
date: 2023-10-05 10:05:03
tags:
  - Next.js
readingTime: 3
description: "Next.js 14 がリリースされました。App Router が実験的機能から推奨方式になりました。本番環境での実践経験について真剣に議論する時が来ました。"
wordCount: 527
---

Next.js 14 がリリースされました。App Router が実験的機能から推奨方式になりました。本番環境での実践経験について真剣に議論する時が来ました。

## App Router コアコンセプト

### ファイルシステムルーティング

```
app/
├── layout.tsx          # ルートレイアウト
├── page.tsx            # ホームページ (/)
├── loading.tsx         # ホームページ loading UI
├── error.tsx           # ホームページエラーバウンダリ
├── posts/
│   ├── layout.tsx      # Posts レイアウト
│   ├── page.tsx        # Posts 一覧 (/posts)
│   ├── [id]/
│   │   ├── page.tsx    # Post 詳細 (/posts/123)
│   │   └── not-found.tsx
└── api/
    └── route.ts        # API ルート
```

### レイアウトシステム

```tsx
// app/layout.tsx - ルートレイアウト
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

// app/posts/layout.tsx - Posts レイアウト
export default function PostsLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_300px]">
      <section>{children}</section>
      <aside>{sidebar}</aside>
    </div>
  );
}
```

レイアウトはナビゲーション時に再レンダリングされず、クライアントの状態を保持します。これは App Router の Pages Router に対する最大の改善点の一つです。

## Server Actions（Next.js 14 の新機能）

```tsx
// app/posts/actions.ts
"use server";

import { revalidatePath } from "next/cache";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  const post = await db.post.create({
    data: { title, content, authorId: getCurrentUser().id },
  });

  revalidatePath("/posts");
  return { id: post.id };
}

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidatePath("/posts");
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from "../actions";

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" required />
      <textarea name="content" placeholder="内容" required />
      <button type="submit">发布</button>
    </form>
  );
}
```

API route や fetch、state 管理を手動で書く必要はありません。"use server" とマークされた関数は Server Component から直接呼び出せ、フォーム送信は自動的に Server Action を通ります。

## ストリーミングレンダリングと Suspense

```tsx
// app/posts/page.tsx
import { Suspense } from "react";

async function PostList() {
  // 遅いクエリをシミュレート
  const posts = await db.post.findMany({ take: 20 });
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/posts/${post.id}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  );
}

async function PostStats() {
  const stats = await db.post.aggregate({ _count: true });
  return <p>共 {stats._count} 篇文章</p>;
}

export default function PostsPage() {
  return (
    <div>
      <h1>文章列表</h1>
      {/* PostStats と PostList は並行して読み込まれる */}
      <Suspense fallback={<p>加载统计中...</p>}>
        <PostStats />
      </Suspense>
      <Suspense fallback={<PostListSkeleton />}>
        <PostList />
      </Suspense>
    </div>
  );
}
```

2つの Suspense 境界内のコンポーネントは並行して読み込まれ、統計情報が先に返され、記事リストは後から到着します。ユーザーは全体的な白い画面を見ることはありません。

## キャッシュ戦略

```tsx
// デフォルトキャッシュ：fetch は自動的にキャッシュ
const data = await fetch("https://api.example.com/posts");
// Next.js はデフォルトで static、ビルド時に一度取得

// 強制的に動的に
const data = await fetch("https://api.example.com/posts", {
  cache: "no-store",
});

// 定期的な再検証（ISR）
const data = await fetch("https://api.example.com/posts", {
  next: { revalidate: 60 }, // 60秒後に再検証
});

// オンデマンド再検証
import { revalidateTag } from "next/cache";
// Server Action 内で
revalidateTag("posts");
```

## まとめ

- App Router + RSC により、Next.js は「より優れた SSR フレームワーク」から「フルスタック React フレームワーク」へと進化しました
- Server Actions は従来の API route + client fetch のボイラープレートコードを排除しました
- レイアウトシステムはナビゲーション時に状態を保持し、体験が大幅に向上しました
- ストリーミングレンダリング + Suspense により、TTFB と FCP が大幅に改善されました
- キャッシュ戦略は粒度が細かい反面、概念が多いため、デフォルトの動作を理解するのに時間をかける必要があります
