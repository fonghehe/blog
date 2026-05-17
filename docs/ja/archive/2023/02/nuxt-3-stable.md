---
title: "Nuxt 3 安定版 完全実践ガイド"
date: 2023-02-01 09:31:40
tags:
  - Nuxt.js
readingTime: 3
description: "Nuxt 3 基于 Vue 3 + Nitro 服务引擎 + Vite，提供了全栈 Vue 开发的最佳实践。相比 Nuxt 2，它在类型安全、性能、部署灵活性方面都有质的提升。本文从实际项目出发，介绍 Nuxt 3 的核心特性。"
---

Nuxt 3 基于 Vue 3 + Nitro 服务引擎 + Vite，提供了全栈 Vue 开发的最佳实践。相比 Nuxt 2，它在类型安全、性能、部署灵活性方面都有质的提升。本文从实际项目出发，介绍 Nuxt 3 的核心特性。

## ディレクトリ構造と自動インポート

Nuxt 3 延续了约定式目录结构，但做了简化。`composables/`、`components/`、`layouts/` 目录中的文件会被自动导入，不需要手动 `import`。

```
nuxt-app/
├── app.vue                // 根组件
├── pages/                 // 文件路由
│   ├── index.vue
│   └── blog/
│       ├── index.vue
│       └── [slug].vue
├── components/            // 自动导入
│   ├── PostCard.vue
│   └── blog/
│       └── CommentList.vue  // <BlogCommentList />
├── composables/           // 自动导入
│   └── useAuth.ts
├── layouts/               // 布局
│   └── default.vue
├── server/                // 服务端
│   ├── api/
│   │   └── posts.get.ts
│   └── utils/
│       └── db.ts
├── middleware/            // 路由中间件
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

自动导入带来的便利是显著的，但也容易造成命名冲突。建议给组件加上目录前缀（`blog/CommentList.vue` 变成 `<BlogCommentList />`）。

## データフェッチ：useFetch と useAsyncData

Nuxt 3 提供了 `useFetch` 和 `useAsyncData` 两个组合式 API。`useFetch` 是 `useAsyncData` + `$fetch` 的封装，大多数场景用 `useFetch` 就够了。

```vue
<!-- pages/blog/[slug].vue -->
<script setup lang="ts">
const route = useRoute()

const { data: post, pending, error, refresh } = await useFetch(
  `/api/posts/${route.params.slug}`,
  {
    key: `post-${route.params.slug}`,
    // 数据缓存时间
    getCachedData(key, nuxtApp) {
      return nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    },
  }
)

// SEO 元数据
useHead({
  title: post.value?.title || '加载中...',
  meta: [
    { name: 'description', content: post.value?.excerpt },
  ],
})

// 动态 OG 图
defineOgImage({
  title: post.value?.title,
  component: 'PostOgImage',
})
</script>

<template>
  <div v-if="pending">加载中...</div>
  <div v-else-if="error">加载失败: {{ error.message }}</div>
  <article v-else>
    <h1>{{ post.title }}</h1>
    <div v-html="post.content" />
  </article>
</template>
```

## Nitro サーバーエンジン

Nuxt 3 的服务端引擎 Nitro，支持从同一个代码库部署到 Node.js、Cloudflare Workers、Vercel、AWS Lambda 等多种平台。

```ts
// server/api/posts.get.ts
import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const limit = parseInt(query.limit as string) || 20

  // 服务端自动导入 db 工具
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
      statusMessage: '标题不能为空',
    })
  }

  const post = await db.post.update({
    where: { id },
    data: body,
  })

  return post
})
```

文件名即路由：`posts.get.ts` 对应 `GET /api/posts`，`[id].put.ts` 对应 `PUT /api/posts/:id`。这种约定比手动配置路由更简洁。

## ミドルウェアと認証フロー

Nuxt 3 的中间件分三种：路由中间件、命名中间件、内联中间件。路由中间件放在 `middleware/` 目录，会在路由切换时自动执行。

```ts
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useAuthUser()

  if (!user.value) {
    // 未登录，重定向到登录页
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
    // 已登录，重定向到首页
    return navigateTo('/')
  }
})
```

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'guest', // 应用 guest 中间件
})
</script>

<!-- pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth', // 应用 auth 中间件
})
</script>
```

## デプロイ設定

Nuxt 3 的部署配置极其灵活，通过 `nitro` 配置指定目标平台：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  // 预渲染已知路由
  nitro: {
    prerender: {
      routes: ['/about', '/contact'],
    },
  },

  // 模块配置
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/image',
  ],

  // 运行时配置（不要在这里放敏感信息）
  runtimeConfig: {
    // 仅服务端可访问
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    // 客户端也可访问（会暴露在 HTML 中）
    public: {
      apiBase: process.env.API_BASE_URL || '/api',
    },
  },
})
```

```bash
# 部署到不同平台
npx nuxi build --preset node          # Node.js 服务器
npx nuxi build --preset cloudflare    # Cloudflare Workers
npx nuxi build --preset vercel        # Vercel
npx nuxi build --preset netlify       # Netlify
```

## まとめ

- Nuxt 3 基于 Vue 3 Composition API，自动导入机制大幅减少样板代码
- `useFetch` 是数据获取的核心 API，内置缓存、loading、error 处理
- Nitro 服务引擎支持多平台部署，同一套代码可部署到 Node/Edge/Serverless
- 路由中间件 + `definePageMeta` 实现鉴权，比 Nuxt 2 的写法更类型安全
- TypeScript 原生支持是 Nuxt 3 最大的改进之一，自动为路由、API、composables 生成类型