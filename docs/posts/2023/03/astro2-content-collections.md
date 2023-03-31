---
title: "Astro 2.0：Content Collections 让内容管理有了类型安全"
date: 2023-03-31 15:47:49
tags:
  - 前端
---

Astro 2.0 于 2023 年 1 月 24 日正式发布，最重要的新特性是 Content Collections——一套专为 Markdown/MDX 内容设计的类型安全 API。如果你用 Astro 构建博客、文档站或内容型网站，这个特性会彻底改变你组织内容的方式。

## 什么是 Content Collections

之前的 Astro，内容文件是"自由放置"的，没有统一的结构约束：

```
// 旧方式：无类型约束，frontmatter 可以是任何内容
---
title: 我的文章
date: 2023-01-01
author: Alice
# 不小心漏了 description 字段？运行时才知道
---
```

Astro 2.0 的 Content Collections：

```
src/content/
  config.ts          ← 定义 collection schema
  blog/
    2023-01-01-hello.md
    2023-01-15-world.mdx
  docs/
    getting-started.md
    api-reference.md
```

## 定义 Collection Schema

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
    // 封面图（可选）
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

// 导出所有 collections
export const collections = {
  blog: blogCollection,
  docs: docsCollection,
};
```

## 查询和使用

```typescript
// src/pages/blog/index.astro
---
import { getCollection } from 'astro:content';

// 获取所有非草稿文章，按日期倒序
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

## 动态路由生成

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
    <p>发布于 {post.data.publishDate.toLocaleDateString('zh-CN')}</p>
    {post.data.tags.map(tag => <span class="tag">{tag}</span>)}
  </header>
  <Content />
</article>
```

## Content Collections 的类型安全

```typescript
// IDE 中，post.data 会有完整类型提示
const posts = await getCollection("blog");
posts[0].data.title; // string ✓
posts[0].data.publishDate; // Date ✓
posts[0].data.tags; // string[] ✓
posts[0].data.nonExistent; // TypeScript 报错 ✓

// 运行时也会校验（Zod schema）
// 如果 frontmatter 格式不对，构建时直接报错，而不是运行时静默失败
```

## Data Collections（JSON/YAML）

Content Collections 不只支持 Markdown，也支持纯数据文件：

```yaml
# src/content/authors/alice.yaml
name: Alice Chen
bio: 前端工程师，专注于 Angular 和性能优化
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
alice.data.name; // "Alice Chen" — 完整类型推断
```

## Astro 2.0 其他重要更新

- **Hybrid Rendering**：同一项目中混合 SSG 和 SSR，按页面单独配置
- **Error Overlay 改进**：更清晰的构建错误提示
- **HMR 稳定性提升**：开发体验显著改善

```typescript
// astro.config.mjs — Hybrid Rendering
export default defineConfig({
  output: "hybrid", // 默认静态，单独页面可以 opt-in SSR
});

// 某个页面 opt-in 服务端渲染
// src/pages/api/search.ts
export const prerender = false; // 这个路由不预渲染，走 SSR
```

## 总结

Astro 2.0 的 Content Collections 将"Markdown 作为数据库"的想法升级到了类型安全的版本。对于内容驱动的站点（技术博客、文档站、营销页面），它解决了 CMS 太重而纯文件管理太松散的中间地带。Zod schema 验证在构建时捕获内容错误，比运行时发现问题要友好得多。