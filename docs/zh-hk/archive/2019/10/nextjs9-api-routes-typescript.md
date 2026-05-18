---
title: "Next.js 9 新特性：API Routes 和 TypeScript 支持"
date: 2019-10-18 14:35:07
tags:
  - TypeScript
readingTime: 2
description: "Next.js 9 在 9 月底發佈，帶來了兩個重要特性：內置 TypeScript 支持和更完善的 API Routes。"
---

Next.js 9 在 9 月底發佈，帶來了兩個重要特性：內置 TypeScript 支持和更完善的 API Routes。

## 內置 TypeScript

```bash
# 不再需要手動配置，直接創建 tsconfig.json
touch tsconfig.json
npm run dev  # Next.js 自動填充 tsconfig.json

# 或者直接創建 .tsx 文件，Next.js 會提示安裝必要的包
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

## API Routes 完善

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

// pages/api/users/[id].ts（動態路由）
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { id } = req.query;
  const userId = parseInt(id as string);

  if (isNaN(userId)) {
    return res.status(400).json({ error: "無效的 ID" });
  }

  const user = await db.users.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: "用户不存在" });
  }

  res.json(user);
}
```

## 動態路由（Catch-all Routes）

```typescript
// pages/docs/[...slug].tsx
// 匹配 /docs/a, /docs/a/b, /docs/a/b/c

import { GetStaticPaths, GetStaticProps } from "next";

export const getStaticPaths: GetStaticPaths = async () => {
  // 生成所有可能的路徑
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

## 自動靜態優化改進

Next.js 9 改進了自動靜態優化的判斷：

```typescript
// 這個頁面會被靜態優化（沒有 getServerSideProps / getInitialProps）
const AboutPage = () => <div>關於我們</div>
export default AboutPage

// 構建時自動變成靜態 HTML，無需服務器
```

## 和 Nuxt.js 的對比

| 特性       | Next.js 9 | Nuxt.js 2                   |
| 
---------- | --------- | --------------------------- |
| 框架       | React     | Vue                         |
| TypeScript | 內置支持  | 需要配置                    |
| API Routes | ✅ 內置   | ❌（需要 serverMiddleware） |
| 靜態生成   | 路由級別  | 整站                        |
| 社區規模   | 大        | 中                          |

## 小結

- Next.js 9 內置 TypeScript，零配置開箱即用
- API Routes 讓 Next.js 成為真正的全棧框架
- Catch-all Routes `[...slug]` 處理嵌套動態路徑
- 靜態優化繼續完善，沒有數據獲取的頁面自動預渲染
