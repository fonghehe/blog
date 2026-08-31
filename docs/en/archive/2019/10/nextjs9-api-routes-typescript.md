---
title: "Next.js 9 New Features: API Routes and TypeScript Support"
date: 2019-10-18 14:35:07
tags:
  - TypeScript
readingTime: 1
description: "Next.js 9 was released at the end of September and brought two notable features: built-in TypeScript support and more complete API Routes."
wordCount: 121
---

Next.js 9 was released at the end of September and brought two notable features: built-in TypeScript support and more complete API Routes.

## Built-in TypeScript

```bash
# 不再需要手动配置，直接创建 tsconfig.json
touch tsconfig.json
npm run dev  # Next.js 自动填充 tsconfig.json

# 或者直接创建 .tsx 文件，Next.js 会提示安装必要的包
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

## API Routes Enhancements

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

// pages/api/users/[id].ts（动态路由）
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

## Dynamic Routes (Catch-all Routes)

```typescript
// pages/docs/[...slug].tsx
// 匹配 /docs/a, /docs/a/b, /docs/a/b/c

import { GetStaticPaths, GetStaticProps } from "next";

export const getStaticPaths: GetStaticPaths = async () => {
  // 生成所有可能的路径
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

## Improved Automatic Static Optimization

Next.js 9 improved how it decides whether a page can be statically optimized:

```typescript
// 这个页面会被静态优化（没有 getServerSideProps / getInitialProps）
const AboutPage = () => <div>关于我们</div>
export default AboutPage

// 构建时自动变成静态 HTML，无需服务器
```

## Comparison with Nuxt.js

| Feature           | Next.js 9 | Nuxt.js 2                   |
| ----------------- | --------- | --------------------------- |
| Framework         | React     | Vue                         |
| TypeScript        | Built-in  | Requires configuration      |
| API Routes        | ✅ Built-in | ❌ (needs serverMiddleware) |
| Static generation | Per-route | Whole site                  |
| Community size    | Large     | Medium                      |

## Summary

- Next.js 9 ships TypeScript built in—zero-config and ready to use out of the box
- API Routes turn Next.js into a genuine full-stack framework
- Catch-all Routes `[...slug]` handle nested dynamic paths
- Static optimization keeps improving: pages without data fetching are pre-rendered automatically
