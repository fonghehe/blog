---
title: "Astro 3.0：島嶼架構的全面進化"
date: 2023-12-05 10:05:28
tags:
  - 前端
readingTime: 2
description: "Astro 3.0 釋出了。從 2.0 的\"有趣概念\"到 3.0 的\"可以認真用在生產環境\"，這個框架的成熟速度超出預期。"
---

Astro 3.0 釋出了。從 2.0 的"有趣概念"到 3.0 的"可以認真用在生產環境"，這個框架的成熟速度超出預期。

## 核心理念：預設零 JS

Astro 的元件預設在構建時渲染成靜態 HTML，不傳送任何 JavaScript。只有顯式標記的互動元件（"島嶼"）才會載入 JS。

```astro
---
// 這部分在構建時執行，不會出現在客戶端
import { getPosts } from "../lib/api";
import Layout from "../layouts/Base.astro";
import PostCard from "../components/PostCard.astro";
import LikeButton from "../components/LikeButton";

const posts = await getPosts();
---

<Layout title="部落格">
  <h1>最新文章</h1>

  <!-- 純靜態元件：零 JS -->
  {posts.map((post) => (
    <PostCard post={post} />
  ))}

  <!-- 互動島嶼：只加載這個元件的 JS -->
  <LikeButton client:visible postId={posts[0].id} />
</Layout>
```

`PostCard` 是 Astro 元件，構建時渲染成 HTML。`LikeButton` 是 React 元件，標了 `client:visible`，只有進入視口才載入。

## 島嶼指令

```astro
<!-- 頁面載入時立即 hydrate -->
<Header client:load />

<!-- 進入視口時 hydrate（推薦） -->
<Comments client:visible />

<!-- 空閒時 hydrate（低優先順序） -->
<Analytics client:idle />

<!-- 只在特定媒體查詢時 hydrate -->
<Sidebar client:media="(min-width: 768px)" />

<!-- 手動控制 -->
<ExpensiveChart client:only="react" />
```

## 多框架混用

Astro 的殺手特性：同一個頁面可以用 React、Vue、Svelte、Solid 元件。

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

這意味著你可以漸進式遷移框架，或者在最適合的場景用最適合的工具。

## View Transitions（3.0 新特性）

```astro
---
// astro.config.mjs
import { defineConfig } from "astro/config";

export default defineConfig({
  viewTransitions: true,
});
---

<!-- 在 layout 中啟用 -->
<head>
  <ViewTransitions />
</head>

<!-- 元件指定 transition 名稱 -->
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

Content Collections 提供了型別安全的 Markdown/MDX 內容管理。Zod schema 校驗 frontmatter，TypeScript 型別自動推斷。

## 效能資料

部落格站點對比（~50 篇文章）：

```
Next.js (SSG):
  JS bundle: 142KB
  LCP: 1.8s
  效能評分: 88

Astro 3.0:
  JS bundle: 18KB
  LCP: 0.9s
  效能評分: 99
```

JS 體積差距巨大，因為 Astro 只加載必要的島嶼 JS。

## 適合的場景

- 內容站點（部落格、文件、營銷頁面）
- 需要極致效能的場景
- 漸進式增強的專案
- 需要混合使用多個前端框架的場景

**不適合：**
- 重度互動的 SPA（管理後臺、複雜表單）
- 需要即時資料更新的場景

## 小結

- Astro 3.0 的島嶼架構讓內容站點的 JS 體積降到最低
- 多框架混用是獨特優勢，適合漸進式遷移
- View Transitions 原生支援，頁面切換動畫不再需要 JS 庫
- Content Collections 提供型別安全的內容管理
- 內容驅動的站點首選 Astro，SPA 類專案還是用 Next.js / Nuxt