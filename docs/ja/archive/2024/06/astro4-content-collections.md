---
title: "Astro 4 Content Collections：コンテンツ駆動のサイトアーキテクチャ"
date: 2024-06-25 14:59:36
tags:
  - React
readingTime: 2
description: "最近、Astro 4 で社内ドキュメントサイトをリファクタリングしました。Content Collections は Astro の最も特徴的な機能の一つで、コンテンツ駆動型プロジェクトに適しています。アーキテクチャの設計と実践経験を共有します。"
wordCount: 433
---

最近、Astro 4 で社内ドキュメントサイトをリファクタリングしました。Content Collections は Astro の最も特徴的な機能の一つで、コンテンツ駆動型プロジェクトに適しています。アーキテクチャの設計と実践経験を共有します。

## Content Collections の基礎

Content Collections で Markdown/MDX コンテンツを型安全な方法で管理できます：

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

### スキーマの定義

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

## クエリとレンダリング

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

## ナビゲーションの自動生成

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

## 関連コンテンツのクエリ

ドキュメント間の参照と関連：

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

## MDX でのコンポーネント使用

```mdx
---
title: "Astro 4 Content Collections：コンテンツ駆動のサイトアーキテクチャ"
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

## パフォーマンス最適化

### 静的ビルド

Astro はデフォルトでゼロ JS 出力（インタラクティブアイランドを除く）で、100 記事のサイトのビルド後の全体 JS 容量は約 15KB：

```
Page           Size        JS
/              4.2 KB      2.1 KB
/docs/guide    8.1 KB      3.4 KB
/blog/post     6.7 KB      2.8 KB
```

### コンテンツキャッシュ

Astro 4 はコンテンツコレクションのビルドキャッシュを内蔵：

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

## まとめ

- Content Collections は型安全な Markdown/MDX コンテンツ管理を提供
- スキーマは Zod で定義、IDE のオートコンプリートと型チェックを完備
- 静的パスを自動生成し、SSG と組み合わせて最高のパフォーマンスを実現
- MDX でドキュメントにカスタムコンポーネントを埋め込める
- ドキュメントサイト、ブログ、ナレッジベースなどコンテンツ中心のプロジェクトに最適
