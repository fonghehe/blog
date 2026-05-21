---
title: "Astro 1.0: The Content-First Frontend Framework"
date: 2022-06-07 15:28:54
tags:
  - Frontend
readingTime: 2
description: "Astro 1.0 正式发布了。它的核心理念很明确：默认输出零 JavaScript，只在需要交互的地方加载 JS。对于内容型网站（博客、文档、营销页），这个方案比 React/Vue 全家桶高效得多。"
wordCount: 326
---

Astro 1.0 正式发布了。它的核心理念很明确：默认输出零 JavaScript，只在需要交互的地方加载 JS。对于内容型网站（博客、文档、营销页），这个方案比 React/Vue 全家桶高效得多。

## 核心理念：Islands Architecture

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

页面大部分是静态 HTML，只有标记为「Island」的组件才会加载 JS 并变成可交互的。

## Getting Started

```bash
pnpm create astro@latest my-site
cd my-site
pnpm install
pnpm dev
```

## Astro 组件语法

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

## Client Directives：控制何时加载 JS

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

## 混合框架

Astro 支持在同一个项目中混合使用不同框架：

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

这在微前端场景或渐进式迁移中很有用。

## 内容集合（Content Collections）

Astro 1.0 的杀手特性：用 TypeScript 类型安全的方式管理 Markdown 内容。

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

## 构建输出

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

静态构建输出的是纯 HTML + CSS + 极少量 JS。我们博客项目构建后，首页 JS 体积只有 2KB（React 做的搜索组件）。

## Performance Comparison

同一个博客项目用不同方案的 Lighthouse 分数：

| 框架 | Performance | JS 体积 |
|------|-------------|---------|
| Next.js (SSG) | 78 | 180KB |
| Gatsby | 72 | 220KB |
| Astro | 98 | 2KB |

## Summary

Astro 不是要替代 React/Vue，而是填补了一个空白：内容型网站不需要 SPA 的复杂度。默认零 JS、Islands Architecture、混合框架支持——这些特性让它成为文档站和博客的最佳选择。