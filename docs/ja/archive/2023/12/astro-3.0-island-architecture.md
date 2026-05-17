---
title: "Astro 3.0：アイランドアーキテクチャの全面進化"
date: 2023-12-05 10:05:28
tags:
  - フロントエンド
readingTime: 3
description: "Astro 3.0 がリリースされました。2.0 の「面白いコンセプト」から 3.0 の「本番環境で真剣に使える」へ、このフレームワークの成熟速度は予想を超えています。"
---

Astro 3.0 がリリースされました。2.0 の「面白いコンセプト」から 3.0 の「本番環境で真剣に使える」へ、このフレームワークの成熟速度は予想を超えています。

## コア理念：デフォルトゼロ JS

Astro 的组件默认在构建时渲染成静态 HTML，不发送任何 JavaScript。只有显式标记的交互组件（"岛屿"）才会加载 JS。

```astro
---
// 这部分在构建时执行，不会出现在客户端
import { getPosts } from "../lib/api";
import Layout from "../layouts/Base.astro";
import PostCard from "../components/PostCard.astro";
import LikeButton from "../components/LikeButton";

const posts = await getPosts();
---

<Layout title="博客">
  <h1>最新文章</h1>

  <!-- 纯静态组件：零 JS -->
  {posts.map((post) => (
    <PostCard post={post} />
  ))}

  <!-- 交互岛屿：只加载这个组件的 JS -->
  <LikeButton client:visible postId={posts[0].id} />
</Layout>
```

`PostCard` は Astro コンポーネントで、ビルド時に HTML にレンダリングされます。`LikeButton` は React コンポーネントで `client:visible` が付いており、ビューポートに入ったときのみ読み込まれます。

## アイランドディレクティブ

```astro
<!-- 页面加载时立即 hydrate -->
<Header client:load />

<!-- 进入视口时 hydrate（推荐） -->
<Comments client:visible />

<!-- 空闲时 hydrate（低优先级） -->
<Analytics client:idle />

<!-- 只在特定媒体查询时 hydrate -->
<Sidebar client:media="(min-width: 768px)" />

<!-- 手动控制 -->
<ExpensiveChart client:only="react" />
```

## 複数フレームワーク混在

Astro 的杀手特性：同一个页面可以用 React、Vue、Svelte、Solid 组件。

```astro
---
import ReactHeader from "../components/Header.tsx";
import VueSidebar from "../components/Sidebar.vue";
import SvelteFooter from "../components/Footer.svelte";
---

<ReactHeader client:load />
<main>
  <slot />
</main>
<VueSidebar client:media="(min-width: 768px)" />
<SvelteFooter client:idle />
```

这意味着你可以渐进式迁移框架，或者在最适合的场景用最适合的工具。

## View Transitions（3.0 の新機能）

```astro
---
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  viewTransitions: true,
});
---

<!-- 在 layout 中启用 -->
<head>
  <ViewTransitions />
</head>

<!-- 组件指定 transition 名称 -->
<h1 transition:name="page-title">{title}</h1>
<img transition:name="hero-image" src={hero} />
```

ブラウザネイティブの View Transitions API で、JS ライブラリ不要。ページ遷移時に自動的にスムーズなアニメーションが行われます。

## Content Collections

```typescript
// src/content/config.ts
import { z, defineCollection } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    description: z.string(),
    tags: z.array(z.string()),
    hero: z.string().optional(),
  }),
});

export const collections = { blog };
```

```astro
---
import { getCollection } from "astro:content";

const posts = await getCollection("blog");
const sortedPosts = posts.sort(
  (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
);
---

{sortedPosts.map((post) => (
  <a href={`/blog/${post.slug}`}>
    <h2>{post.data.title}</h2>
    <time>{post.data.pubDate.toLocaleDateString()}</time>
  </a>
))}
```

Content Collections は型安全な Markdown/MDX コンテンツ管理を提供します。Zod スキーマが frontmatter を検証し、TypeScript の型が自動的に推論されます。

## パフォーマンスデータ

ブログサイト比較（~50記事）：

```
Next.js (SSG):
  JS bundle: 142KB
  LCP: 1.8s
  性能评分: 88

Astro 3.0:
  JS bundle: 18KB
  LCP: 0.9s
  性能评分: 99
```

JS バンドルサイズの差は大きく、Astro は必要なアイランド JS のみを読み込むためです。

## 適切なユースケース

- コンテンツサイト（ブログ、ドキュメント、マーケティングページ）
- 極限的なパフォーマンスが求められるシナリオ
- プログレッシブエンハンスメントのプロジェクト
- 複数のフロントエンドフレームワークを混在させる必要があるシナリオ

**不向き：**
- 重いインタラクションの SPA（管理ダッシュボード、複雑なフォーム）
- リアルタイムデータ更新が必要なシナリオ

## まとめ

- Astro 3.0 のアイランドアーキテクチャによりコンテンツサイトの JS バンドルサイズが最小化されます
- マルチフレームワーク混在は独自の強みで、段階的な移行に適しています
- ネイティブ View Transitions サポートにより、ページ遷移アニメーションに JS ライブラリが不要
- Content Collections が型安全なコンテンツ管理を提供
- コンテンツ駆動サイトには Astro が第一選択肢で、SPA 系プロジェクトは Next.js / Nuxt が依然として適切