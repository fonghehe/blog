---
title: "Nuxt 3 正式版完整實踐指南"
date: 2023-02-01 09:31:40
tags:
  - Nuxt.js
readingTime: 3
description: "Nuxt 3 基於 Vue 3 + Nitro 服務引擎 + Vite，提供了全棧 Vue 開發的最佳實踐。相比 Nuxt 2，它在類型安全、性能、部署靈活性方面都有質的提升。本文從實際項目出發，介紹 Nuxt 3 的核心特性。"
---

Nuxt 3 基於 Vue 3 + Nitro 服務引擎 + Vite，提供了全棧 Vue 開發的最佳實踐。相比 Nuxt 2，它在類型安全、性能、部署靈活性方面都有質的提升。本文從實際項目出發，介紹 Nuxt 3 的核心特性。

## 目錄結構與自動導入

Nuxt 3 延續了約定式目錄結構，但做了簡化。`composables/`、`components/`、`layouts/` 目錄中的文件會被自動導入，不需要手動 `import`。

```
nuxt-app/
├── app.vue                // 根組件
├── pages/                 // 文件路由
│   ├── index.vue
│   └── blog/
│       ├── index.vue
│       └── [slug].vue
├── components/            // 自動導入
│   ├── PostCard.vue
│   └── blog/
│       └── CommentList.vue  // <BlogCommentList />
├── composables/           // 自動導入
│   └── useAuth.ts
├── layouts/               // 佈局
│   └── default.vue
├── server/                // 服務端
│   ├── api/
│   │   └── posts.get.ts
│   └── utils/
│       └── db.ts
├── middleware/            // 路由中間件
│   └── auth.ts
└── nuxt.config.ts
```

```vue
<!-- app.vue -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

自動導入帶來的便利是顯著的，但也容易造成命名衝突。建議給組件加上目錄前綴（`blog/CommentList.vue` 變成 `<BlogCommentList />`）。

## 數據獲取：useFetch 與 useAsyncData

Nuxt 3 提供了 `useFetch` 和 `useAsyncData` 兩個組合式 API。`useFetch` 是 `useAsyncData` + `$fetch` 的封裝，大多數場景用 `useFetch` 就夠了。

```vue
<!-- pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute()

const { data: post, pending, error, refresh } = await useFetch(
  `/api/posts/${route.params.slug}`,
  {
    key: `post-${route.params.slug}`,
    // 數據緩存時間
    getCachedData(key, nuxtApp) {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    },
  }
)

// SEO 元數據
useHead({
  title: post.value?.title || '加載中...',
  meta: [
    { name: 'description', content: post.value?.excerpt },
  ],
})

// 動態 OG 圖
defineOgImage({
  title: post.value?.title,
  component: 'PostOgImage',
})
</script>

<template>
  <div v-if="pending">加載中...</div>
  <div v-else-if="error">加載失敗: {{ error.message }}</div>
  <article v-else>
    <h1>{{ post.title }}</h1>
    <div v-html="post.content" />
  </article>
</template>
```

## Nitro 服務端引擎

Nuxt 3 的服務端引擎 Nitro，支持從同一個代碼庫部署到 Node.js、Cloudflare Workers、Vercel、AWS Lambda 等多種平台。

```ts
// server/api/posts.get.ts
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20

  // 服務端自動導入 db 工具
  const posts = await db.post.findMany({
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  return { posts, page, total: await db.post.count() }
})

// server/api/posts/[id].put.ts
import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: '標題不能為空',
    })
  }

  const post = await db.post.update({
    where: { id },
    data: body,
  })

  return post
})
```

文件名即路由：`posts.get.ts` 對應 `GET /api/posts`，`[id].put.ts` 對應 `PUT /api/posts/:id`。這種約定比手動配置路由更簡潔。

## 中間件與認證流程

Nuxt 3 的中間件分三種：路由中間件、命名中間件、內聯中間件。路由中間件放在 `middleware/` 目錄，會在路由切換時自動執行。

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useAuthUser()

  if (!user.value) {
    // 未登錄，重定向到登錄頁
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
})

// middleware/guest.ts
export default defineNuxtRouteMiddleware(() => {
  const user = useAuthUser()

  if (user.value) {
    // 已登錄，重定向到首頁
    return navigateTo('/')
  }
})
```

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'guest', // 應用 guest 中間件
})
</script>

<!-- pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth', // 應用 auth 中間件
})
</script>
```

## 部署配置

Nuxt 3 的部署配置極其靈活，通過 `nitro` 配置指定目標平台：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // 預渲染已知路由
  nitro: {
    prerender: {
      routes: ['/about', '/contact'],
    },
  },

  // 模塊配置
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/image',
  ],

  // 運行時配置（不要在這裏放敏感信息）
  runtimeConfig: {
    // 僅服務端可訪問
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // 客户端也可訪問（會暴露在 HTML 中）
    public: {
      apiBase: process.env.API_BASE_URL || '/api',
    },
  },
})
```

```bash
# 部署到不同平台
npx nuxi build --preset node          # Node.js 服務器
npx nuxi build --preset cloudflare    # Cloudflare Workers
npx nuxi build --preset vercel        # Vercel
npx nuxi build --preset netlify       # Netlify
```

## 小結

- Nuxt 3 基於 Vue 3 Composition API，自動導入機制大幅減少樣板代碼
- `useFetch` 是數據獲取的核心 API，內置緩存、loading、error 處理
- Nitro 服務引擎支持多平台部署，同一套代碼可部署到 Node/Edge/Serverless
- 路由中間件 + `definePageMeta` 實現鑑權，比 Nuxt 2 的寫法更類型安全
- TypeScript 原生支持是 Nuxt 3 最大的改進之一，自動為路由、API、composables 生成類型