---
title: "Astro 3.0: The Full Evolution of Island Architecture"
date: 2023-12-05 10:05:28
tags:
  - Frontend
readingTime: 2
description: "Astro 3.0 is out. From 2.0's \"interesting concept\" to 3.0's \"ready for serious production use\", this framework has matured faster than expected."
---

Astro 3.0 is out. From 2.0's "interesting concept" to 3.0's "ready for serious production use", this framework has matured faster than expected.

## Core Philosophy: Zero JS by Default

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

`PostCard` is an Astro component, rendered into HTML at build time. `LikeButton` is a React component marked with `client:visible`, loading only when it enters the viewport.

## Island Directives

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

## Multi-Framework Usage

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

## View Transitions (New in 3.0)

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

Browser-native View Transitions API, no JS library needed. Smooth animations happen automatically during page transitions.

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

Content Collections provides type-safe Markdown/MDX content management. Zod schema validates frontmatter, with TypeScript types automatically inferred.

## Performance Data

Blog site comparison (~50 articles):

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

The JS bundle size gap is significant because Astro only loads the necessary island JS.

## Suitable Use Cases

- Content sites (blogs, documentation, marketing pages)
- Scenarios requiring extreme performance
- Projects with progressive enhancement
- Scenarios requiring multiple frontend frameworks

**Not suitable for:**
- Heavy interactive SPAs (admin dashboards, complex forms)
- Scenarios requiring real-time data updates

## Summary

- Astro 3.0's island architecture minimizes JS bundle size for content sites
- Multi-framework mixing is a unique advantage, ideal for gradual migration
- Native View Transitions support means no JS library needed for page transition animations
- Content Collections provides type-safe content management
- Astro is the first choice for content-driven sites; SPA-type projects still prefer Next.js / Nuxt