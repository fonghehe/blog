---
title: "Astro 4 Content Collections：內容驅動的站點架構"
date: 2024-06-25 10:00:00
tags:
  - React
readingTime: 2
description: "最近用 Astro 4 重構了一個內部文檔站點。Content Collections 是 Astro 最有特色的功能之一，適合內容驅動型項目。分享一下架構設計和實踐經驗。"
---

最近用 Astro 4 重構了一個內部文檔站點。Content Collections 是 Astro 最有特色的功能之一，適合內容驅動型項目。分享一下架構設計和實踐經驗。

## Content Collections 基礎

Content Collections 讓你用類型安全的方式管理 Markdown/MDX 內容：

```
src/content/
├── docs/
│   ├── getting-started.mdx
│   ├── api-reference.md
│   └── troubleshooting.mdx
├── blog/
│   ├── 2024-01-01-new-year.mdx
│   └── 2024-06-25-astro-guide.mdx
└── config.ts          ← 類型定義
```

### 定義 Schema

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

## 查詢和渲染

```astro
---
// src/pages/docs/[...slug].astro
import { getCollection, getEntry } from "astro:content";
import DocLayout from "@/layouts/DocLayout.astro";

// 靜態路徑生成
export async function getStaticPaths() {
  const docs = await getCollection("docs", ({ data }) => {
    return !data.draft; // 過濾草稿
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

## 目錄導航自動生成

```typescript
// src/lib/toc.ts
import { getCollection } from "astro:content";

export async function buildDocSidebar() {
  const docs = await getCollection("docs", ({ data }) => !data.draft);

  // 按 category 分組，再按 order 排序
  const grouped = docs.reduce(
    (acc, doc) => {
      const cat = doc.data.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(doc);
      return acc;
    },
    {} as Record<string, typeof docs>
  );

  // 每組內按 order 排序
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
  }

  return grouped;
}
```

## 關聯內容查詢

文檔間的引用和關聯：

```typescript
// 找到同一標籤的所有文章
const related = await getCollection("blog", ({ data }) => {
  return data.tags.some((tag) => currentPost.data.tags.includes(tag));
});

// 按日期排序取最新 5 篇
const recentRelated = related
  .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
  .slice(0, 5);
```

## MDX 中使用組件

```mdx
---
title: API 認證指南
category: guide
order: 3
---

import { Callout, CodeBlock } from "@/components/docs";

# API 認證指南

<Callout type="warning">
  API Key 不要暴露在前端代碼中。
</Callout>

## Token 獲取

<CodeBlock code={`
const token = await auth.getToken({
  scope: "read:docs write:comments"
});
`} lang="typescript" />
```

## 性能優化

### 靜態構建

Astro 默認零 JS 輸出（除了交互島嶼），100 篇文檔的站點構建後全站 JS 體積約 15KB：

```
Page           Size        JS
/              4.2 KB      2.1 KB
/docs/guide    8.1 KB      3.4 KB
/blog/post     6.7 KB      2.8 KB
```

### 內容緩存

Astro 4 內置內容集合的構建緩存：

```typescript
// astro.config.mjs
export default defineConfig({
  output: "static",
  build: {
    // 內容不變時跳過重新處理
    inlineStylesheets: "auto",
  },
});
```

## 小結

- Content Collections 提供類型安全的 Markdown/MDX 內容管理
- Schema 定義用 Zod，IDE 自動補全和類型檢查一應俱全
- 自動生成靜態路徑，配合 SSG 獲得最佳性能
- MDX 支持在文檔中嵌入自定義組件
- 適合文檔站、博客、知識庫等以內容為主的項目
