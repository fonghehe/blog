---
title: "Astro 2.0：Content Collections 讓內容管理有了型別安全"
date: 2023-03-31 15:47:49
tags:
  - 前端
readingTime: 2
description: "Astro 2.0 於 2023 年 1 月 24 日正式釋出，最重要的新特性是 Content Collections——一套專為 Markdown/MDX 內容設計的型別安全 API。如果你用 Astro 構建部落格、檔案站或內容型網站，這個特性會徹底改變你組織內容的方式。"
wordCount: 304
---

Astro 2.0 於 2023 年 1 月 24 日正式釋出，最重要的新特性是 Content Collections——一套專為 Markdown/MDX 內容設計的型別安全 API。如果你用 Astro 構建部落格、文件站或內容型網站，這個特性會徹底改變你組織內容的方式。

## 什麼是 Content Collections

之前的 Astro，內容檔案是"自由放置"的，沒有統一的結構約束：

```
// 舊方式：無型別約束，frontmatter 可以是任何內容
---
title: 我的文章
date: 2023-01-01
author: Alice
# 不小心漏了 description 欄位？執行時才知道
---
```

Astro 2.0 的 Content Collections：

```
src/content/
  config.ts          ← 定義 collection schema
  blog/
    2023-01-01-hello.md
    2023-01-15-world.mdx
  docs/
    getting-started.md
    api-reference.md
```

## 定義 Collection Schema

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  type: "content", // 'content'（Markdown/MDX）或 'data'（JSON/YAML）
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    author: z.string().default("匿名"),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // 封面圖（可選）
    cover: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
  }),
});

const docsCollection = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
  }),
});

// 匯出所有 collections
export const collections = {
  blog: blogCollection,
  docs: docsCollection,
};
```

## 查詢和使用

```typescript
// src/pages/blog/index.astro
---
import { getCollection } from 'astro:content';

// 獲取所有非草稿文章，按日期倒序
const allPosts = await getCollection('blog', ({ data }) => !data.draft);
const sortedPosts = allPosts.sort(
  (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf()
);
---

<ul>
  {sortedPosts.map(post => (
    <li>
      <a href={`/blog/${post.slug}`}>
        <h2>{post.data.title}</h2>
        <p>{post.data.description}</p>
        <time>{post.data.publishDate.toLocaleDateString('zh-CN')}</time>
      </a>
    </li>
  ))}
</ul>
```

## 動態路由生成

```typescript
// src/pages/blog/[slug].astro
---
import { getCollection, getEntry } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

interface Props {
  post: CollectionEntry<'blog'>;
}

const { post } = Astro.props;
const { Content, headings } = await post.render();
---

<article>
  <header>
    <h1>{post.data.title}</h1>
    <p>釋出於 {post.data.publishDate.toLocaleDateString('zh-CN')}</p>
    {post.data.tags.map(tag => <span class="tag">{tag}</span>)}
  </header>
  <Content />
</article>
```

## Content Collections 的型別安全

```typescript
// IDE 中，post.data 會有完整型別提示
const posts = await getCollection("blog");
posts[0].data.title; // string ✓
posts[0].data.publishDate; // Date ✓
posts[0].data.tags; // string[] ✓
posts[0].data.nonExistent; // TypeScript 報錯 ✓

// 執行時也會校驗（Zod schema）
// 如果 frontmatter 格式不對，構建時直接報錯，而不是執行時靜默失敗
```

## Data Collections（JSON/YAML）

Content Collections 不隻支援 Markdown，也支援純資料檔案：

```yaml
# src/content/authors/alice.yaml
name: Alice Chen
bio: 前端工程師，專注於 Angular 和效能最佳化
avatar: /avatars/alice.jpg
twitter: "@alicechen"
```

```typescript
// src/content/config.ts
const authorsCollection = defineCollection({
  type: "data",
  schema: z.object({
    name: z.string(),
    bio: z.string(),
    avatar: z.string(),
    twitter: z.string().optional(),
  }),
});

// 使用
const alice = await getEntry("authors", "alice");
alice.data.name; // "Alice Chen" — 完整型別推斷
```

## Astro 2.0 其他重要更新

- **Hybrid Rendering**：同一專案中混合 SSG 和 SSR，按頁面單獨配置
- **Error Overlay 改進**：更清晰的構建錯誤提示
- **HMR 穩定性提升**：開發體驗顯著改善

```typescript
// astro.config.mjs — Hybrid Rendering
export default defineConfig({
  output: "hybrid", // 預設靜態，單獨頁面可以 opt-in SSR
});

// 某個頁面 opt-in 服務端渲染
// src/pages/api/search.ts
export const prerender = false; // 這個路由不預渲染，走 SSR
```

## 總結

Astro 2.0 的 Content Collections 將"Markdown 作為資料庫"的想法升級到了型別安全的版本。對於內容驅動的站點（技術部落格、文件站、營銷頁面），它解決了 CMS 太重而純檔案管理太鬆散的中間地帶。Zod schema 驗證在構建時捕獲內容錯誤，比執行時發現問題要友好得多。