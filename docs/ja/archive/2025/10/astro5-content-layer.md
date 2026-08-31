---
title: "Astro 5：Content Layer がコンテンツ管理を再定義"
date: 2025-10-28 16:22:59
tags:
  - React
readingTime: 2
description: "Astro 5 がリリースされた。最大の変化は Content Layer API だ。コンテンツ駆動のサイトにとって、これは意義深いアップグレードだ。"
wordCount: 282
---

Astro 5 がリリースされた。最大の変化は Content Layer API だ。コンテンツ駆動のサイトにとって、これは意義深いアップグレードだ。

## Content Layer 是什么

```
之前：Content Collections 只支持本地 Markdown/MDX 文件
现在：Content Layer 可以从任何数据源加载内容

数据源：
  - 本地 Markdown/MDX 文件
  - CMS（Contentful、Sanity、Strapi）
  - 数据库
  - API
  - 文件系统（JSON、YAML）
  - 自定义数据源
```

## 基础配置

```ts
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// 博客文章（本地 Markdown）
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()),
    author: z.string().default("匿名"),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// 产品数据（从 CMS 加载）
const products = defineCollection({
  loader: async () => {
    const response = await fetch("https://api.contentful.com/spaces/xxx/entries", {
      headers: {
        Authorization: `Bearer ${process.env.CONTENTFUL_TOKEN}`,
      },
    });
    const data = await response.json();
    return data.items.map((item: any) => ({
      id: item.sys.id,
      ...item.fields,
    }));
  },
  schema: z.object({
    name: z.string(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    inStock: z.boolean(),
  }),
});

// 团队成员（从 API 加载）
const team = defineCollection({
  loader: async () => {
    const response = await fetch("https://api.example.com/team");
    return response.json();
  },
  schema: z.object({
    name: z.string(),
    role: z.string(),
    avatar: z.string(),
    bio: z.string(),
  }),
});

export const collections = { blog, products, team };
```

## 查询 API

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, getEntry } from "astro:content";
import type { GetStaticPaths } from "astro";

// 获取所有博客文章
export const getStaticPaths = (async () => {
  const posts = await getCollection("blog", ({ data }) => {
    return !data.draft; // 过滤掉草稿
  });

  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}) satisfies GetStaticPaths;

const { post } = Astro.props;
const { Content } = await post.render();

// 获取相关文章
const relatedPosts = await getCollection("blog", ({ data, id }) => {
  return (
    id !== post.id &&
    data.tags.some((tag) => post.data.tags.includes(tag))
  );
});
---

<article>
  <h1>{post.data.title}</h1>
  <time datetime={post.data.date.toISOString()}>
    {post.data.date.toLocaleDateString("zh-CN")}
  </time>
  <Content />

  <section>
    <h2>相关文章</h2>
    <ul>
      {relatedPosts.slice(0, 3).map((related) => (
        <li>
          <a href={`/blog/${related.slug}`}>
            {related.data.title}
          </a>
        </li>
      ))}
    </ul>
  </section>
</article>
```

## カスタムデータソースプラグイン

```ts
// src/loaders/notion-loader.ts
// 从 Notion 数据库加载内容
import type { Loader } from "astro/loaders";
import { Client } from "@notionhq/client";

export function notionLoader(options: {
  databaseId: string;
  token: string;
}): Loader {
  const notion = new Client({ auth: options.token });

  return {
    name: "notion-loader",
    async load({ store, meta }) {
      // 检查是否需要更新
      const lastSync = meta.get("lastSync");
      if (lastSync && Date.now() - Number(lastSync) < 60000) {
        return; // 1 分钟内不重复同步
      }

      const response = await notion.databases.query({
        database_id: options.databaseId,
        filter: {
          property: "Status",
          select: { equals: "Published" },
        },
      });

      for (const page of response.results) {
        const content = await getPageContent(notion, page.id);
        store.set({
          id: page.id,
          data: {
            title: page.properties.Title.title[0].plain_text,
            date: page.properties.Date.date.start,
            content,
          },
        });
      }

      meta.set("lastSync", String(Date.now()));
    },
  };
}
```

## 与 View Transitions 配合

```astro
---
// src/layouts/BaseLayout.astro
import { ViewTransitions } from "astro:transitions";
---

<html>
  <head>
    <ViewTransitions />
  </head>
  <body>
    <nav transition:animate="slide">
      <a href="/">首页</a>
      <a href="/blog">博客</a>
      <a href="/products">产品</a>
    </nav>
    <main transition:animate="fade">
      <slot />
    </main>
  </body>
</html>

// 页面切换时自动有丝滑的过渡动画
// 不需要写任何 CSS
```

## 性能表现

```
Astro 5 基准测试（100 页内容站）：

构建时间：8s（vs Next.js 45s）
首屏 JS：0 KB（默认零 JS）
Lighthouse：100/100
TTFB：45ms
LCP：0.8s

Astro 的岛屿架构：
  - 默认输出纯 HTML
  - 只有标记为 client:* 的组件才会发送 JS
  - 内容站几乎是零 JS
```

## まとめ

- Astro 5 の Content Layer により、データソースはローカルファイルに限定されなくなった
- カスタム Loader はあらゆるデータソース（CMS・データベース・API）に接続可能
- クエリ API は簡潔かつ強力で、絞り込みと関連付けに対応
- デフォルトで JS ゼロの出力を実現し、コンテンツサイトのパフォーマンスを極限まで引き出す
- View Transitions が滑らかなページ遷移体験を提供
- ドキュメントサイト・ブログ・マーケティングページなどコンテンツ駆動のプロジェクトに最適
