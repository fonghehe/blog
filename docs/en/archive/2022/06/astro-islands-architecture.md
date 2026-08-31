---
title: "Astro 1.0: The Content-First Frontend Framework"
date: 2022-06-07 15:28:54
tags:
  - Frontend
readingTime: 2
description: "Astro 1.0 has been officially released. Its core philosophy is clear: output zero JavaScript by default, and only load JS where interactivity is needed. For content-driven sites (blogs, docs, marketing pages), this approach is far more efficient than the full React/Vue stack."
wordCount: 201
---

Astro 1.0 has been officially released. Its core philosophy is clear: output zero JavaScript by default, and only load JS where interactivity is needed. For content-driven sites (blogs, docs, marketing pages), this approach is far more efficient than the full React/Vue stack.

## Core Concept: Islands Architecture

```
┌─────────────────────────────┐
│     静态 HTML（零 JS）        │
│  ┌─────────┐  ┌──────────┐  │
│  │ Island  │  │ Island   │  │
│  │ (React) │  │ (Vue)    │  │
│  │ client: │  │ client:  │  │
│  │ load    │  │ visible  │  │
│  └─────────┘  └──────────┘  │
│     静态 HTML（零 JS）        │
└─────────────────────────────┘
```

Most of the page is static HTML; only components marked as "Islands" load JS and become interactive.

## Getting Started

```bash
pnpm create astro@latest my-site
cd my-site
pnpm install
pnpm dev
```

## Astro Component Syntax

```astro
---
// --- 之间是服务端代码（构建时执行）
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import CommentWidget from '../components/CommentWidget';

const posts = await fetch('https://api.example.com/posts')
  .then(r => r.json());

const title = '我的技术博客';
---

<Layout title={title}>
  <Header />

  <main>
    {posts.map(post => (
      <article>
        <h2>{post.title}</h2>
        <p>{post.excerpt}</p>
        <time>{new Date(post.date).toLocaleDateString('zh-CN')}</time>
      </article>
    ))}
  </main>

  <!-- 这个组件会在客户端加载 JS -->
  <CommentWidget client:load />
</Layout>
```

## Client Directives: Controlling When JS Loads

```astro
---
import ChatWidget from '../components/ChatWidget';
import Sidebar from '../components/Sidebar';
import Video from '../components/Video';
import Search from '../components/Search';
---

<!-- 页面加载后立即 hydrate -->
<ChatWidget client:load />

<!-- 组件进入视口后才 hydrate（懒加载） -->
<Sidebar client:visible />

<!-- 空闲时 hydrate（requestIdleCallback） -->
<Search client:idle />

<!-- 只在特定媒体查询匹配时 hydrate -->
<Video client:media="(max-width: 768px)" />

<!-- 只在客户端渲染（SSR 时不渲染） -->
<HeavyChart client:only="react" />
```

## Mixing Frameworks

Astro supports mixing different frameworks in the same project:

```astro
---
import ReactHeader from '../components/Header.tsx';
import VueCard from '../components/Card.vue';
import SvelteFooter from '../components/Footer.svelte';
import SolidSidebar from '../components/Sidebar.tsx';
---

<ReactHeader client:load />
<VueCard />
<SvelteFooter />
<SolidSidebar client:visible />
```

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import solid from '@astrojs/solid-js';

export default defineConfig({
  integrations: [react(), vue(), svelte(), solid()],
});
```

This is useful in micro-frontend scenarios or for incremental migrations.

## Content Collections

Astro 1.0's killer feature: managing Markdown content with TypeScript type safety.

```typescript
// src/content/config.ts
import { z, defineCollection } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
```

```astro
---
import { getCollection } from 'astro:content';

// 类型安全！如果 frontmatter 不符合 schema，构建时就会报错
const posts = await getCollection('blog', ({ data }) => {
  return !data.draft;
});

// 按日期排序
const sorted = posts.sort(
  (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
);
---

{sorted.map(post => (
  <a href={`/blog/${post.slug}`}>
    <h2>{post.data.title}</h2>
    <time>{post.data.date}</time>
  </a>
))}
```

## Build Output

```typescript
// astro.config.mjs
export default defineConfig({
  // 静态站（默认）
  output: 'static',

  // 或 SSR 模式
  // output: 'server',
  // adapter: vercel(),
});
```

Static builds output pure HTML + CSS + minimal JS. After building our blog project, the homepage JS is only 2KB (a React-powered search component).

## Performance Comparison

Lighthouse scores for the same blog project using different solutions:

| Framework | Performance | JS Size |
|------|-------------|---------|
| Next.js (SSG) | 78 | 180KB |
| Gatsby | 72 | 220KB |
| Astro | 98 | 2KB |

## Summary

Astro isn't trying to replace React/Vue — it fills a gap: content-driven sites don't need the complexity of an SPA. Zero JS by default, Islands Architecture, and multi-framework support make it the best choice for documentation sites and blogs.