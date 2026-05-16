---
title: "Astro 4 Content Collections: Content-Driven Site Architecture"
date: 2024-06-25 10:00:00
tags:
  - React
readingTime: 2
description: "I recently rebuilt an internal documentation site with Astro 4. Content Collections is one of Astro's most distinctive features and is well-suited for content-d"
---

I recently rebuilt an internal documentation site with Astro 4. Content Collections is one of Astro's most distinctive features and is well-suited for content-driven projects. Here I share the architectural design and practical experience.

## Content Collections Basics

Content Collections let you manage Markdown/MDX content in a type-safe way:

```
src/content/
├── docs/
│   ├── getting-started.mdx
│   ├── api-reference.md
│   └── troubleshooting.mdx
├── blog/
│   ├── 2024-01-01-new-year.mdx
│   └── 2024-06-25-astro-guide.mdx
└── config.ts          ← 类型定义
```

### Defining the Schema

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(["guide", "api", "tutorial", "faq"]),
    tags: z.array(z.string()).default([]),
    order: z.number().optional(),
    draft: z.boolean().default(false),
    lastUpdated: z.date(),
  }),
});

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    cover: z.string().optional(),
    excerpt: z.string(),
    tags: z.array(z.string()),
  }),
});

export const collections = { docs, blog };
```

## Querying and Rendering

```astro
---
// src/pages/docs/[...slug].astro
import { getCollection, getEntry } from "astro:content";
import DocLayout from "@/layouts/DocLayout.astro";

// 静态路径生成
export async function getStaticPaths() {
  const docs = await getCollection("docs", ({ data }) => {
    return !data.draft; // 过滤草稿
  });

  return docs.map((doc) => ({
    params: { slug: doc.slug },
    props: { doc },
  }));
}

const { doc } = Astro.props;
const { Content, headings } = await doc.render();
---

<DocLayout title={doc.data.title} headings={headings}>
  <Content />
</DocLayout>
```

## Auto-generating Table of Contents

```typescript
// src/lib/toc.ts
import { getCollection } from "astro:content";

export async function buildDocSidebar() {
  const docs = await getCollection("docs", ({ data }) => !data.draft);

  // 按 category 分组，再按 order 排序
  const grouped = docs.reduce(
    (acc, doc) => {
      const cat = doc.data.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    },
    {} as Record<string, typeof docs>
  );

  // 每组内按 order 排序
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
  }

  return grouped;
}
```

## Related Content Querying

References and associations between documents:

```typescript
// 找到同一标签的所有文章
const related = await getCollection("blog", ({ data }) => {
  return data.tags.some((tag) => currentPost.data.tags.includes(tag));
});

// 按日期排序取最新 5 篇
const recentRelated = related
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  .slice(0, 5);
```

## Using Components in MDX

```mdx
---
title: "Astro 4 Content Collections: Content-Driven Site Architecture"
category: guide
order: 3
---

import { Callout, CodeBlock } from "@/components/docs";

# API 认证指南

<Callout type="warning">
  API Key 不要暴露在前端代码中。
</Callout>

## Token 获取

<CodeBlock code={`
const token = await auth.getToken({
  scope: "read:docs write:comments"
});
`} lang="typescript" />
```

## Performance Optimization

### Static Build

Astro outputs zero JS by default (except for interactive islands). A 100-document site builds with a total JS footprint of about 15KB:

```
Page           Size        JS
/              4.2 KB      2.1 KB
/docs/guide    8.1 KB      3.4 KB
/blog/post     6.7 KB      2.8 KB
```

### Content Caching

Astro 4 has built-in build caching for content collections:

```typescript
// astro.config.mjs
export default defineConfig({
  output: "static",
  build: {
    // 内容不变时跳过重新处理
    inlineStylesheets: "auto",
  },
});
```

## Summary

- Content Collections provide type-safe Markdown/MDX content management
- Schema defined with Zod, complete with IDE autocomplete and type checking
- Automatically generates static paths, working with SSG for optimal performance
- MDX supports embedding custom components in documents
- Well-suited for content-heavy projects like documentation sites, blogs, and knowledge bases
