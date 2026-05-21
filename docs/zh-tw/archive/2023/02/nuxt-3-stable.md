---
title: "Nuxt 3 正式版完整實踐指南"
date: 2023-02-01 09:31:40
tags:
  - Nuxt.js
readingTime: 3
description: "Nuxt 3 基於 Vue 3 + Nitro 服務引擎 + Vite，提供了全棧 Vue 開發的最佳實踐。相比 Nuxt 2，它在型別安全、效能、部署靈活性方面都有質的提升。本文從實際專案出發，介紹 Nuxt 3 的核心特性。"
wordCount: 465
---

Nuxt 3 基於 Vue 3 + Nitro 服務引擎 + Vite，提供了全棧 Vue 開發的最佳實踐。相比 Nuxt 2，它在型別安全、效能、部署靈活性方面都有質的提升。本文從實際專案出發，介紹 Nuxt 3 的核心特性。

## 目錄結構與自動匯入

Nuxt 3 延續了約定式目錄結構，但做了簡化。`composables/`、`components/`、`layouts/` 目錄中的檔案會被自動匯入，不需要手動 `import`。

```
nuxt-app/
├── app.vue                // 根元件
├── pages/                 // 檔案路由
│   ├── index.vue
│   └── blog/
│       ├── index.vue
│       └── [slug].vue
├── components/            // 自動匯入
│   ├── PostCard.vue
│   └── blog/
│       └── CommentList.vue  // <BlogCommentList />
├── composables/           // 自動匯入
│   └── useAuth.ts
├── layouts/               // 佈局
│   └── default.vue
├── server/                // 服務端
│   ├── api/
│   │   └── posts.get.ts
│   └── utils/
│       └── db.ts
├── middleware/            // 路由中介軟體
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

自動匯入帶來的便利是顯著的，但也容易造成命名衝突。建議給元件加上目錄字首（`blog/CommentList.vue` 變成 `<BlogCommentList />`）。

## 資料獲取：useFetch 與 useAsyncData

Nuxt 3 提供了 `useFetch` 和 `useAsyncData` 兩個組合式 API。`useFetch` 是 `useAsyncData` + `$fetch` 的封裝，大多數場景用 `useFetch` 就夠了。

```vue
<!-- pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute()

const { data: post, pending, error, refresh } = await useFetch(
  `/api/posts/${route.params.slug}`,
  {
    key: `post-${route.params.slug}`,
    // 資料快取時間
    getCachedData(key, nuxtApp) {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    },
  }
)

// SEO 後設資料
useHead({
  title: post.value?.title || '載入中...',
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
  <div v-if="pending">載入中...</div>
  <div v-else-if="error">載入失敗: {{ error.message }}</div>
  <article v-else>
    <h1>{{ post.title }}</h1>
    <div v-html="post.content" />
  </article>
</template>
```

## Nitro 服務端引擎

Nuxt 3 的服務端引擎 Nitro，支援從同一個程式碼庫部署到 Node.js、Cloudflare Workers、Vercel、AWS Lambda 等多種平臺。

```ts
// server/api/posts.get.ts
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20

  // 服務端自動匯入 db 工具
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

檔名即路由：`posts.get.ts` 對應 `GET /api/posts`，`[id].put.ts` 對應 `PUT /api/posts/:id`。這種約定比手動配置路由更簡潔。

## 中介軟體與認證流程

Nuxt 3 的中介軟體分三種：路由中介軟體、命名中介軟體、內聯中介軟體。路由中介軟體放在 `middleware/` 目錄，會在路由切換時自動執行。

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useAuthUser()

  if (!user.value) {
    // 未登入，重定向到登入頁
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
    // 已登入，重定向到首頁
    return navigateTo('/')
  }
})
```

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'guest', // 應用 guest 中介軟體
})
</script>

<!-- pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth', // 應用 auth 中介軟體
})
</script>
```

## 部署配置

Nuxt 3 的部署配置極其靈活，通過 `nitro` 配置指定目標平臺：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // 預渲染已知路由
  nitro: {
    prerender: {
      routes: ['/about', '/contact'],
    },
  },

  // 模組配置
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/image',
  ],

  // 執行時配置（不要在這裡放敏感資訊）
  runtimeConfig: {
    // 僅服務端可訪問
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // 客戶端也可訪問（會暴露在 HTML 中）
    public: {
      apiBase: process.env.API_BASE_URL || '/api',
    },
  },
})
```

```bash
# 部署到不同平臺
npx nuxi build --preset node          # Node.js 伺服器
npx nuxi build --preset cloudflare    # Cloudflare Workers
npx nuxi build --preset vercel        # Vercel
npx nuxi build --preset netlify       # Netlify
```

## 小結

- Nuxt 3 基於 Vue 3 Composition API，自動匯入機制大幅減少樣板程式碼
- `useFetch` 是資料獲取的核心 API，內建快取、loading、error 處理
- Nitro 服務引擎支援多平臺部署，同一套程式碼可部署到 Node/Edge/Serverless
- 路由中介軟體 + `definePageMeta` 實現鑑權，比 Nuxt 2 的寫法更型別安全
- TypeScript 原生支援是 Nuxt 3 最大的改進之一，自動為路由、API、composables 生成型別