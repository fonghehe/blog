---
title: "Astro 3.0：岛屿架构的全面进化"
date: 2023-12-05 10:05:28
tags:
  - 前端
readingTime: 2
description: "Astro 3.0 发布了。从 2.0 的\"有趣概念\"到 3.0 的\"可以认真用在生产环境\"，这个框架的成熟速度超出预期。"
wordCount: 445
---

Astro 3.0 发布了。从 2.0 的"有趣概念"到 3.0 的"可以认真用在生产环境"，这个框架的成熟速度超出预期。

## 核心理念：默认零 JS

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

`PostCard` 是 Astro 组件，构建时渲染成 HTML。`LikeButton` 是 React 组件，标了 `client:visible`，只有进入视口才加载。

## 岛屿指令

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

## 多框架混用

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

## View Transitions（3.0 新特性）

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

浏览器原生 View Transitions API，不需要 JS 库。页面切换时自动做平滑动画。

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

Content Collections 提供了类型安全的 Markdown/MDX 内容管理。Zod schema 校验 frontmatter，TypeScript 类型自动推断。

## 性能数据

博客站点对比（~50 篇文章）：

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

JS 体积差距巨大，因为 Astro 只加载必要的岛屿 JS。

## 适合的场景

- 内容站点（博客、文档、营销页面）
- 需要极致性能的场景
- 渐进式增强的项目
- 需要混合使用多个前端框架的场景

**不适合：**
- 重度交互的 SPA（管理后台、复杂表单）
- 需要实时数据更新的场景

## 小结

- Astro 3.0 的岛屿架构让内容站点的 JS 体积降到最低
- 多框架混用是独特优势，适合渐进式迁移
- View Transitions 原生支持，页面切换动画不再需要 JS 库
- Content Collections 提供类型安全的内容管理
- 内容驱动的站点首选 Astro，SPA 类项目还是用 Next.js / Nuxt