---
title: "Next.js 9 新特性：API Routes 和 TypeScript 支持"
date: 2019-10-18 14:35:07
tags:
  - TypeScript
readingTime: 2
description: "Next.js 9 在 9 月底发布，带来了两个重要特性：内置 TypeScript 支持和更完善的 API Routes。"
---

Next.js 9 在 9 月底发布，带来了两个重要特性：内置 TypeScript 支持和更完善的 API Routes。

## 内置 TypeScript

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

## 动态路由（Catch-all Routes）

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

## 自动静态优化改进

Next.js 9 改进了自动静态优化的判断：

```typescript
// 这个页面会被静态优化（没有 getServerSideProps / getInitialProps）
const AboutPage = () => <div>关于我们</div>
export default AboutPage

// 构建时自动变成静态 HTML，无需服务器
```

## 和 Nuxt.js 的对比

| 特性       | Next.js 9 | Nuxt.js 2                   |
| 
---------- | --------- | --------------------------- |
| 框架       | React     | Vue                         |
| TypeScript | 内置支持  | 需要配置                    |
| API Routes | ✅ 内置   | ❌（需要 serverMiddleware） |
| 静态生成   | 路由级别  | 整站                        |
| 社区规模   | 大        | 中                          |

## 小结

- Next.js 9 内置 TypeScript，零配置开箱即用
- API Routes 让 Next.js 成为真正的全栈框架
- Catch-all Routes `[...slug]` 处理嵌套动态路径
- 静态优化继续完善，没有数据获取的页面自动预渲染
