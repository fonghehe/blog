---
title: "Astro 2.0：Content Collections がコンテンツ管理に型安全性をもたらす"
date: 2023-03-31 15:47:49
tags:
  - フロントエンド
readingTime: 3
description: "Astro 2.0 は2023年1月24日に正式リリースされました。最も重要な新機能は Content Collections です——Markdown/MDX コンテンツ向けに設計された型安全な API セットです。Astro でブログ、ドキュメントサイト、コンテンツ型サイトを構築する場合、この機能はコンテンツの整理方法を根本的に変えます。"
wordCount: 496
---

Astro 2.0 は 2023 年 1 月 24 日に正式リリースされました。最も重要な新機能は Content Collections です。Markdown/MDX コンテンツ向けに設計された型安全な API セットです。Astro でブログ、ドキュメントサイト、コンテンツ型サイトを構築する場合、この機能はコンテンツの整理方法を根本的に変えます。

## Content Collections とは

以前の Astro では、コンテンツファイルは「自由配置」で、統一された構造の制約がありませんでした：

```
// 旧方式：型制約なし、frontmatter は何でもあり
---
title: "Astro 2.0：Content Collections がコンテンツ管理に型安全性をもたらす"
date: 2023-01-01
author: Alice
# description フィールドをうっかり忘れても？実行時にしか分からない
---
```

Astro 2.0 の Content Collections：

```
src/content/
  config.ts          ← collection スキーマを定義
  blog/
    2023-01-01-hello.md
    2023-01-15-world.mdx
  docs/
    getting-started.md
    api-reference.md
```

## Collection Schema の定義

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  type: "content", // 'content'（Markdown/MDX）または 'data'（JSON/YAML）
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.date(),
    author: z.string().default("匿名"),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // カバー画像（オプション）
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

// すべての collections をエクスポート
export const collections = {
  blog: blogCollection,
  docs: docsCollection,
};
```

## クエリと使い方

```typescript
// src/pages/blog/index.astro
---
import { getCollection } from 'astro:content';

// すべての非下書き記事を取得し、日付の降順で並べる
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

## 動的ルート生成

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

## Content Collections の型安全性

```typescript
// IDE で post.data に完全な型補完が表示される
const posts = await getCollection("blog");
posts[0].data.title; // string ✓
posts[0].data.publishDate; // Date ✓
posts[0].data.tags; // string[] ✓
posts[0].data.nonExistent; // TypeScript がエラーを出す ✓

// 実行時にもバリデーションされる（Zod schema）
// frontmatter の形式が間違っている場合、ビルド時に直接エラーになる。実行時に静かに失敗することはない
```

## Data Collections（JSON/YAML）

Content Collections は Markdown だけでなく、純粋なデータファイルもサポートしています：

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

// 使用例
const alice = await getEntry("authors", "alice");
alice.data.name; // "Alice Chen" — 完全な型推論
```

## Astro 2.0 のその他の重要なアップデート

- **Hybrid Rendering**：同一プロジェクト内で SSG と SSR を混在させ、ページ単位で個別に設定可能
- **Error Overlay の改善**：より明確なビルドエラーメッセージ
- **HMR の安定性向上**：開発体験が大幅に改善

```typescript
// astro.config.mjs — Hybrid Rendering
export default defineConfig({
  output: "hybrid", // デフォルトは静的、個別のページで SSR に opt-in 可能
});

// あるページでサーバーサイドレンダリングを opt-in
// src/pages/api/search.ts
export const prerender = false; // このルートはプリレンダリングせず、SSR で動作
```

## まとめ

Astro 2.0 の Content Collections は、「Markdown をデータベースとして使う」というアイデアを型安全なバージョンにアップグレードしました。コンテンツ駆動型サイト（技術ブログ、ドキュメントサイト、マーケティングページ）にとって、CMS は重厚すぎるが純粋なファイル管理は緩すぎるという中間領域を解決します。Zod スキーマバリデーションにより、ビルド時にコンテンツエラーを捕捉できるため、実行時に問題を発見するよりもはるかに親切です。
