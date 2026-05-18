---
title: "Astro 5：Content Layer 重新定義內容管理"
date: 2025-10-28 10:00:00
tags:
  - React
readingTime: 2
description: "Astro 5 發佈了，最大的變化是 Content Layer API。對於內容驅動的網站來説，這是一個很有意義的升級。"
---

Astro 5 發佈了，最大的變化是 Content Layer API。對於內容驅動的網站來説，這是一個很有意義的升級。

## Content Layer 是什麼

```
之前：Content Collections 只支持本地 Markdown/MDX 文件
現在：Content Layer 可以從任何數據源加載內容

數據源：
  - 本地 Markdown/MDX 文件
  - CMS（Contentful、Sanity、Strapi）
  - 數據庫
  - API
  - 文件系統（JSON、YAML）
  - 自定義數據源
```

## 基礎配置

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

// 產品數據（從 CMS 加載）
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

// 團隊成員（從 API 加載）
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

## 查詢 API

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection, getEntry } from "astro:content";
import type { GetStaticPaths } from "astro";

// 獲取所有博客文章
export const getStaticPaths = (async () => {
  const posts = await getCollection("blog", ({ data }) => {
    return !data.draft; // 過濾掉草稿
  });

  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}) satisfies GetStaticPaths;

const { post } = Astro.props;
const { Content } = await post.render();

// 獲取相關文章
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
    <h2>相關文章</h2>
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

## 自定義數據源插件

```ts
// src/loaders/notion-loader.ts
// 從 Notion 數據庫加載內容
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
      // 檢查是否需要更新
      const lastSync = meta.get("lastSync");
      if (lastSync && Date.now() - Number(lastSync) < 60000) {
        return; // 1 分鐘內不重複同步
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

## 與 View Transitions 配合

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
      <a href="/">首頁</a>
      <a href="/blog">博客</a>
      <a href="/products">產品</a>
    </nav>
    <main transition:animate="fade">
      <slot />
    </main>
  </body>
</html>

// 頁面切換時自動有絲滑的過渡動畫
// 不需要寫任何 CSS
```

## 性能表現

```
Astro 5 基準測試（100 頁內容站）：

構建時間：8s（vs Next.js 45s）
首屏 JS：0 KB（默認零 JS）
Lighthouse：100/100
TTFB：45ms
LCP：0.8s

Astro 的島嶼架構：
  - 默認輸出純 HTML
  - 只有標記為 client:* 的組件才會發送 JS
  - 內容站幾乎是零 JS
```

## 小結

- Astro 5 的 Content Layer 讓數據源不再侷限於本地文件
- 自定義 Loader 可以對接任何數據源（CMS、數據庫、API）
- 查詢 API 簡潔強大，支持過濾和關聯
- 零 JS 默認輸出，內容站性能極致
- View Transitions 提供了絲滑的頁面切換體驗
- 適合文檔站、博客、營銷頁等內容驅動的項目
