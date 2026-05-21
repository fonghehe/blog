---
title: "Astro 4 Content Collections：内容驱动的站点架构"
date: 2024-06-25 10:00:00
tags:
  - React
readingTime: 2
description: "最近用 Astro 4 重构了一个内部文档站点。Content Collections 是 Astro 最有特色的功能之一，适合内容驱动型项目。分享一下架构设计和实践经验。"
wordCount: 254
---

最近用 Astro 4 重构了一个内部文档站点。Content Collections 是 Astro 最有特色的功能之一，适合内容驱动型项目。分享一下架构设计和实践经验。

## Content Collections 基础

Content Collections 让你用类型安全的方式管理 Markdown/MDX 内容：

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

### 定义 Schema

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

## 查询和渲染

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

## 目录导航自动生成

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

## 关联内容查询

文档间的引用和关联：

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

## MDX 中使用组件

```mdx
---
title: API 认证指南
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

## 性能优化

### 静态构建

Astro 默认零 JS 输出（除了交互岛屿），100 篇文档的站点构建后全站 JS 体积约 15KB：

```
Page           Size        JS
/              4.2 KB      2.1 KB
/docs/guide    8.1 KB      3.4 KB
/blog/post     6.7 KB      2.8 KB
```

### 内容缓存

Astro 4 内置内容集合的构建缓存：

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

## 小结

- Content Collections 提供类型安全的 Markdown/MDX 内容管理
- Schema 定义用 Zod，IDE 自动补全和类型检查一应俱全
- 自动生成静态路径，配合 SSG 获得最佳性能
- MDX 支持在文档中嵌入自定义组件
- 适合文档站、博客、知识库等以内容为主的项目
