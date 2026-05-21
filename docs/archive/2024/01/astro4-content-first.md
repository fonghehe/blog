---
title: "Astro 4：内容优先架构的成熟"
date: 2024-01-15 16:44:54
tags:
  - 前端
readingTime: 2
description: "Astro 4 发布了，用了一年多 Astro 做内容站，说说它为什么适合某类项目，以及真实的工程化体验。"
wordCount: 289
---

Astro 4 发布了，用了一年多 Astro 做内容站，说说它为什么适合某类项目，以及真实的工程化体验。

## 为什么 Astro 适合内容网站

Astro 的核心思路：**默认零 JS，按需水化**。

```
React/Vue/Next.js 思路：JS 优先
  - 下载 JS → 执行 JS → 渲染 HTML

Astro 思路：HTML 优先
  - 服务端渲染 HTML → 发送到浏览器（没有 JS 负担）
  - 只有标记 client:* 的组件才下载 JS
```

对博客、文档、营销页来说，这是正确的优先级。

## Astro 项目结构

```
src/
├── pages/
│   ├── index.astro          ← 主页
│   ├── blog/
│   │   ├── index.astro      ← 博客列表
│   │   └── [slug].astro     ← 博客详情
│   └── about.astro
├── layouts/
│   └── BlogPost.astro
├── components/
│   ├── Header.astro         ← Astro 组件（纯 HTML）
│   └── CommentSection.tsx   ← React 组件（交互）
└── content/
    └── blog/
        ├── hello-world.md
        └── second-post.mdx
```

## Astro 组件语法

```astro
---
// 这里是服务端运行的 JS（frontmatter）
import BlogCard from '../components/BlogCard.astro'
import { getCollection } from 'astro:content'

const posts = await getCollection('blog')
const sortedPosts = posts.sort((a, b) =>
  b.data.publishDate.getTime() - a.data.publishDate.getTime()
)
---

<!-- 这里是 HTML 模板 -->
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>我的博客</title>
</head>
<body>
  <h1>文章列表</h1>

  {sortedPosts.map(post => (
    <BlogCard post={post} />
  ))}
</body>
</html>
```

## 内容集合（Content Collections）

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

文章内容...
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

## Islands 架构：按需水化

```astro
---
import ReactCounter from '../components/Counter.tsx'
import VueSearchBox from '../components/Search.vue'
---

<!-- 纯展示：不下载 JS -->
<Header />

<!-- 需要交互：按需水化 -->
<!-- client:load：页面加载时水化 -->
<ReactCounter client:load />

<!-- client:idle：浏览器空闲时水化 -->
<VueSearchBox client:idle />

<!-- client:visible：进入视口时水化 -->
<LazyChart client:visible />

<!-- client:only="react"：只在客户端渲染，不 SSR -->
<RealTimeData client:only="react" />
```

## Astro 4 新特性

**Dev Toolbar**：开发时的 UI 调试工具，类似 Next.js dev 工具

**View Transitions API 集成**：

```astro
---
import { ViewTransitions } from 'astro:transitions'
---

<head>
  <ViewTransitions />  <!-- 启用页面过渡动画（MPA 也可以！）-->
</head>
```

**Server Islands**：服务端动态内容 + 客户端静态内容混合

## 适合 Astro 的场景

- ✅ 博客、文档、营销页
- ✅ 内容为主，少量交互
- ✅ 需要极致 Lighthouse 分数
- ❌ 复杂交互（用 Next.js/Nuxt.js）
- ❌ 需要实时数据（用全栈框架）

## 小结

- Astro 默认零 JS，比 Next.js 更适合内容站
- Islands 架构：只有需要交互的组件才水化
- 内容集合 + 类型检查，比手写 `import.meta.glob` 优雅得多
- View Transitions API 让 MPA 也有流畅的页面过渡
- 2024 年是 Astro 生态成熟的一年，值得认真学