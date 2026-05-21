---
title: "Astro 3.0：島嶼架構的全面進化"
date: 2023-12-05 10:05:28
tags:
  - 前端
readingTime: 2
description: "Astro 3.0 發佈了。從 2.0 的\"有趣概念\"到 3.0 的\"可以認真用在生產環境\"，這個框架的成熟速度超出預期。"
wordCount: 445
---

Astro 3.0 發佈了。從 2.0 的"有趣概念"到 3.0 的"可以認真用在生產環境"，這個框架的成熟速度超出預期。

## 核心理念：默認零 JS

Astro 的組件默認在構建時渲染成靜態 HTML，不發送任何 JavaScript。只有顯式標記的交互組件（"島嶼"）才會加載 JS。

```astro
---
// 這部分在構建時執行，不會出現在客户端
import { getPosts } from "../lib/api";
import Layout from "../layouts/Base.astro";
import PostCard from "../components/PostCard.astro";
import LikeButton from "../components/LikeButton";

const posts = await getPosts();
---

<Layout title="博客">
  <h1>最新文章</h1>

  <!-- 純靜態組件：零 JS -->
  {posts.map((post) => (
    <PostCard post={post} />
  ))}

  <!-- 交互島嶼：只加載這個組件的 JS -->
  <LikeButton client:visible postId={posts[0].id} />
</Layout>
```

`PostCard` 是 Astro 組件，構建時渲染成 HTML。`LikeButton` 是 React 組件，標了 `client:visible`，只有進入視口才加載。

## 島嶼指令

```astro
<!-- 頁面加載時立即 hydrate -->
<Header client:load />

<!-- 進入視口時 hydrate（推薦） -->
<Comments client:visible />

<!-- 空閒時 hydrate（低優先級） -->
<Analytics client:idle />

<!-- 只在特定媒體查詢時 hydrate -->
<Sidebar client:media="(min-width: 768px)" />

<!-- 手動控制 -->
<ExpensiveChart client:only="react" />
```

## 多框架混用

Astro 的殺手特性：同一個頁面可以用 React、Vue、Svelte、Solid 組件。

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

這意味着你可以漸進式遷移框架，或者在最適合的場景用最適合的工具。

## View Transitions（3.0 新特性）

```astro
---
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  viewTransitions: true,
});
---

<!-- 在 layout 中啓用 -->
<head>
  <ViewTransitions />
</head>

<!-- 組件指定 transition 名稱 -->
<h1 transition:name="page-title">{title}</h1>
<img transition:name="hero-image" src={hero} />
```

瀏覽器原生 View Transitions API，不需要 JS 庫。頁面切換時自動做平滑動畫。

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

Content Collections 提供了類型安全的 Markdown/MDX 內容管理。Zod schema 校驗 frontmatter，TypeScript 類型自動推斷。

## 性能數據

博客站點對比（~50 篇文章）：

```
Next.js (SSG):
  JS bundle: 142KB
  LCP: 1.8s
  性能評分: 88

Astro 3.0:
  JS bundle: 18KB
  LCP: 0.9s
  性能評分: 99
```

JS 體積差距巨大，因為 Astro 只加載必要的島嶼 JS。

## 適合的場景

- 內容站點（博客、文檔、營銷頁面）
- 需要極致性能的場景
- 漸進式增強的項目
- 需要混合使用多個前端框架的場景

**不適合：**
- 重度交互的 SPA（管理後台、複雜表單）
- 需要實時數據更新的場景

## 小結

- Astro 3.0 的島嶼架構讓內容站點的 JS 體積降到最低
- 多框架混用是獨特優勢，適合漸進式遷移
- View Transitions 原生支持，頁面切換動畫不再需要 JS 庫
- Content Collections 提供類型安全的內容管理
- 內容驅動的站點首選 Astro，SPA 類項目還是用 Next.js / Nuxt