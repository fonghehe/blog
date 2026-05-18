---
title: "Astro 4：內容優先架構的成熟"
date: 2024-01-15 16:44:54
tags:
  - 前端
readingTime: 2
description: "Astro 4 釋出了，用了一年多 Astro 做內容站，說說它為什麼適合某類專案，以及真實的工程化體驗。"
---

Astro 4 釋出了，用了一年多 Astro 做內容站，說說它為什麼適合某類專案，以及真實的工程化體驗。

## 為什麼 Astro 適合內容網站

Astro 的核心思路：**預設零 JS，按需水化**。

```
React/Vue/Next.js 思路：JS 優先
  - 下載 JS → 執行 JS → 渲染 HTML

Astro 思路：HTML 優先
  - 服務端渲染 HTML → 傳送到瀏覽器（沒有 JS 負擔）
  - 只有標記 client:* 的元件才下載 JS
```

對部落格、文件、營銷頁來說，這是正確的優先順序。

## Astro 專案結構

```
src/
├── pages/
│   ├── index.astro          ← 主頁
│   ├── blog/
│   │   ├── index.astro      ← 部落格列表
│   │   └── [slug].astro     ← 部落格詳情
│   └── about.astro
├── layouts/
│   └── BlogPost.astro
├── components/
│   ├── Header.astro         ← Astro 元件（純 HTML）
│   └── CommentSection.tsx   ← React 元件（互動）
└── content/
    └── blog/
        ├── hello-world.md
        └── second-post.mdx
```

## Astro 元件語法

```astro
---
// 這裡是服務端執行的 JS（frontmatter）
import BlogCard from '../components/BlogCard.astro'
import { getCollection } from 'astro:content'

const posts = await getCollection('blog')
const sortedPosts = posts.sort((a, b) =>
  b.data.publishDate.getTime() - a.data.publishDate.getTime()
)
---

<!-- 這裡是 HTML 模板 -->
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>我的部落格</title>
</head>
<body>
  <h1>文章列表</h1>

  {sortedPosts.map(post => (
    <BlogCard post={post} />
  ))}
</body>
</html>
```

## 內容集合（Content Collections）

```typescript
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    publishDate: z.date(),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
});

export const collections = { blog };
```

```markdown
---
title: "React 19 新特性"
publishDate: 2024-05-01
tags: ["react", "前端"]
draft: false
---

文章內容...
```

```astro
---
// [slug].astro
import { getCollection, getEntry } from 'astro:content'

export async function getStaticPaths() {
  const posts = await getCollection('blog')
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post }
  }))
}

const { post } = Astro.props
const { Content } = await post.render()
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>
```

## Islands 架構：按需水化

```astro
---
import ReactCounter from '../components/Counter.tsx'
import VueSearchBox from '../components/Search.vue'
---

<!-- 純展示：不下載 JS -->
<Header />

<!-- 需要互動：按需水化 -->
<!-- client:load：頁面載入時水化 -->
<ReactCounter client:load />

<!-- client:idle：瀏覽器空閒時水化 -->
<VueSearchBox client:idle />

<!-- client:visible：進入視口時水化 -->
<LazyChart client:visible />

<!-- client:only="react"：只在客戶端渲染，不 SSR -->
<RealTimeData client:only="react" />
```

## Astro 4 新特性

**Dev Toolbar**：開發時的 UI 除錯工具，類似 Next.js dev 工具

**View Transitions API 整合**：

```astro
---
import { ViewTransitions } from 'astro:transitions'
---

<head>
  <ViewTransitions />  <!-- 啟用頁面過渡動畫（MPA 也可以！）-->
</head>
```

**Server Islands**：服務端動態內容 + 客戶端靜態內容混合

## 適合 Astro 的場景

- ✅ 部落格、文件、營銷頁
- ✅ 內容為主，少量互動
- ✅ 需要極致 Lighthouse 分數
- ❌ 複雜互動（用 Next.js/Nuxt.js）
- ❌ 需要即時資料（用全棧框架）

## 小結

- Astro 預設零 JS，比 Next.js 更適合內容站
- Islands 架構：只有需要互動的元件才水化
- 內容集合 + 型別檢查，比手寫 `import.meta.glob` 優雅得多
- View Transitions API 讓 MPA 也有流暢的頁面過渡
- 2024 年是 Astro 生態成熟的一年，值得認真學