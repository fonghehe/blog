---
title: "Next.js 9 新機能：API RoutesとTypeScriptサポート"
date: 2019-10-18 14:35:07
tags:
  - TypeScript
readingTime: 2
description: "Next.js 9 は 9 月末にリリースされ、2 つの重要な機能が追加されました：組み込みの TypeScript サポートと、より充実した API Routes です。"
wordCount: 277
---

Next.js 9 が 9 月末にリリースされ、2 つの重要な新機能が導入されました：組み込みの TypeScript サポートと強化された API Routes です。

## TypeScriptのビルトインサポート

```bash
# 手動設定は不要になりました。直接 tsconfig.json を作成します
touch tsconfig.json
npm run dev  # Next.js が自動的に tsconfig.json を生成します

# または .tsx ファイルを直接作成すると、Next.js が必要なパッケージのインストールを促します
```

```typescript
// pages/index.tsx
import { GetServerSideProps, NextPage } from 'next'

interface Props {
  posts: Post[]
}

interface Post {
  id: number
  title: string
  excerpt: string
}

const HomePage: NextPage<Props> = ({ posts }) => {
  return (
    <div>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const posts = await fetchPosts()
  return { props: { posts } }
}

export default HomePage
```

## API Routesの強化

```typescript
// pages/api/users/index.ts
import type { NextApiRequest, NextApiResponse } from "next";

type User = { id: number; name: string; email: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<User[] | { error: string }>,
) {
  switch (req.method) {
    case "GET":
      const users = await db.users.findMany();
      res.status(200).json(users);
      break;

    case "POST":
      const { name, email } = req.body;
      if (!name || !email) {
        res.status(400).json({ error: "缺少必要字段" });
        return;
      }
      const user = await db.users.create({ data: { name, email } });
      res.status(201).json(user);
      break;

    default:
      res.status(405).json({ error: "Method not allowed" });
  }
}

// pages/api/users/[id].ts（動的ルート）
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const userId = parseInt(id as string);

  if (isNaN(userId)) {
    return res.status(400).json({ error: "无效的 ID" });
  }

  const user = await db.users.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "用户不存在" });
  }

  res.json(user);
}
```

## 動的ルート（Catch-all Routes）

```typescript
// pages/docs/[...slug].tsx
// /docs/a, /docs/a/b, /docs/a/b/c にマッチ

import { GetStaticPaths, GetStaticProps } from "next";

export const getStaticPaths: GetStaticPaths = async () => {
  // すべての可能なパスを生成
  const allDocs = await getAllDocsSlugs();

  return {
    paths: allDocs.map((slug) => ({ params: { slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string[] };
  const doc = await getDocBySlug(slug.join("/"));

  return { props: { doc } };
};
```

## 自動静的最適化の改善

Next.js 9 では、自動静的最適化の判断が改善されました：

```typescript
// このページは静的最適化されます（getServerSideProps / getInitialProps なし）
const AboutPage = () => <div>关于我们</div>
export default AboutPage

// ビルド時に自動的に静的 HTML になり、サーバーは不要
```

## Nuxt.jsとの比較

| 特性         | Next.js 9 | Nuxt.js 2                   |
| ------------ | --------- | --------------------------- |
| フレームワーク | React     | Vue                         |
| TypeScript   | 組み込み   | 設定が必要                  |
| API Routes   | ✅ 組み込み | ❌（serverMiddleware が必要） |
| 静的生成     | ルート単位 | サイト全体                  |
| コミュニティ規模 | 大       | 中                          |

## まとめ

- Next.js 9 は TypeScript を組み込み、ゼロ設定で即座に使用可能
- API Routes により Next.js は真のフルスタックフレームワークに
- Catch-all Routes `[...slug]` でネストされた動的パスを処理
- 静的最適化がさらに改善され、データ取得のないページは自動的にプリレンダリング
