---
title: "Astro 1.0：內容優先的前端框架"
date: 2022-06-07 15:28:54
tags:
  - 前端
readingTime: 2
description: "Astro 1.0 正式釋出了。它的核心理念很明確：預設輸出零 JavaScript，只在需要互動的地方載入 JS。對於內容型網站（部落格、文件、營銷頁），這個方案比 React/Vue 全家桶高效得多。"
---

Astro 1.0 正式釋出了。它的核心理念很明確：預設輸出零 JavaScript，只在需要互動的地方載入 JS。對於內容型網站（部落格、文件、營銷頁），這個方案比 React/Vue 全家桶高效得多。

## 核心理念：Islands Architecture

```
┌─────────────────────────────┐
│     靜態 HTML（零 JS）        │
│  ┌─────────┐  ┌──────────┐  │
│  │ Island  │  │ Island   │  │
│  │ (React) │  │ (Vue)    │  │
│  │ client: │  │ client:  │  │
│  │ load    │  │ visible  │  │
│  └─────────┘  └──────────┘  │
│     靜態 HTML（零 JS）        │
└─────────────────────────────┘
```

頁面大部分是靜態 HTML，只有標記為「Island」的元件才會載入 JS 並變成可互動的。

## 快速開始

```bash
pnpm create astro@latest my-site
cd my-site
pnpm install
pnpm dev
```

## Astro 元件語法

```astro
---
// 
--- 之間是服務端程式碼（構建時執行）
import Layout from '../layouts/Layout.astro';
import Header from '../components/Header.astro';
import CommentWidget from '../components/CommentWidget';

const posts = await fetch('https://api.example.com/posts')
  .then(r => r.json());

const title = '我的技術部落格';
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

  <!-- 這個元件會在客戶端載入 JS -->
  <CommentWidget client:load />
</Layout>
```

## Client Directives：控制何時載入 JS

```astro
---
import ChatWidget from '../components/ChatWidget';
import Sidebar from '../components/Sidebar';
import Video from '../components/Video';
import Search from '../components/Search';
---

<!-- 頁面載入後立即 hydrate -->
<ChatWidget client:load />

<!-- 元件進入視口後才 hydrate（懶載入） -->
<Sidebar client:visible />

<!-- 空閒時 hydrate（requestIdleCallback） -->
<Search client:idle />

<!-- 只在特定媒體查詢匹配時 hydrate -->
<Video client:media="(max-width: 768px)" />

<!-- 只在客戶端渲染（SSR 時不渲染） -->
<HeavyChart client:only="react" />
```

## 混合框架

Astro 支援在同一個專案中混合使用不同框架：

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

這在微前端場景或漸進式遷移中很有用。

## 內容集合（Content Collections）

Astro 1.0 的殺手特性：用 TypeScript 型別安全的方式管理 Markdown 內容。

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

// 型別安全！如果 frontmatter 不符合 schema，構建時就會報錯
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

## 構建輸出

```typescript
// astro.config.mjs
export default defineConfig({
  // 靜態站（預設）
  output: 'static',

  // 或 SSR 模式
  // output: 'server',
  // adapter: vercel(),
});
```

靜態構建輸出的是純 HTML + CSS + 極少量 JS。我們部落格專案構建後，首頁 JS 體積只有 2KB（React 做的搜尋元件）。

## 效能對比

同一個部落格專案用不同方案的 Lighthouse 分數：

| 框架 | Performance | JS 體積 |
|------|-------------|---------|
| Next.js (SSG) | 78 | 180KB |
| Gatsby | 72 | 220KB |
| Astro | 98 | 2KB |

## 小結

Astro 不是要替代 React/Vue，而是填補了一個空白：內容型網站不需要 SPA 的複雜度。預設零 JS、Islands Architecture、混合框架支援——這些特性讓它成為文件站和部落格的最佳選擇。