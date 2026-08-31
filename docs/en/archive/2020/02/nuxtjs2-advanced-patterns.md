---
title: "Nuxt.js 3: New Routing and Data Fetching Approach"
date: 2020-02-14 10:26:37
tags:
  - Vue
readingTime: 2
description: "Nuxt.js is the dominant meta-framework for Vue in the SSR ecosystem. Nuxt 3 is a complete rewrite on Vue 3, introducing Composition API-driven data fetching and new directory conventions. This article covers the core changes to routing and data fetching in Nuxt 3."
wordCount: 269
---

Nuxt.js is the dominant metaframework for Vue in the SSR ecosystem. Nuxt 3 is a complete rewrite on top of Vue 3, introducing a Composition API-driven approach to data fetching and new directory conventions. This article walks through the core changes to Nuxt 3's routing system and data fetching.

## File-Based Routing System

Nuxt 3 keeps the file-as-route convention, but the syntax for route parameters has changed.

```
pages/
├── index.vue            ->  /
├── about.vue            ->  /about
├── blog/
│   ├── index.vue        ->  /blog
│   ├── [slug].vue       ->  /blog/:slug
│   └── [...all].vue     ->  /blog/* (catch-all)
├── users/
│   ├── index.vue        ->  /users
│   ├── [id].vue         ->  /users/:id
│   └── [id]/
│       └── posts.vue    ->  /users/:id/posts
└── [[optional]].vue     ->  /:optional? (可选参数)
```

```vue
{% raw %}
<!-- pages/blog/[slug].vue -->
<template>
  <article>
    <h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>
  </article>
</template>

<script>
const route = useRoute()
const { data: post } = await useFetch(`/api/blog/${route.params.slug}`)
</script>
{% endraw %}
```

Note that `[slug]` wraps the parameter in square brackets. `[...all]` is the catch-all route, and `[[optional]]` is an optional parameter.

## useFetch: Composition API-Driven Data Fetching

Nuxt 3 replaces the Options API-style `asyncData` and `fetch` with `useFetch`.

```vue
<script>
// 基础用法：自动推断 URL
const { data: users, pending, error, refresh } = await useFetch('/api/users')

// 带配置
const { data: post } = await useFetch('/api/posts/1', {
  key: 'post-detail',   // 缓存 key，防止重复请求
  pick: ['id', 'title', 'content'],  // 只取需要的字段，减小包体
  lazy: true,            // 不阻塞导航
  server: false,         // 仅客户端请求
  transform: (data) => {
    // 数据转换
    return {
      ...data,
      createdAt: new Date(data.createdAt).toLocaleDateString('zh-CN')
    }
  },
  watch: [route.params.id], // 监听变化自动重新请求
  initialCache: false,       // 禁用初始缓存
})

// POST 请求
const { data: result } = await useFetch('/api/posts', {
  method: 'POST',
  body: { title: '新文章', content: '内容...' }
})
</script>
```

During SSR, `useFetch` runs on the server and automatically injects the data into the client-side hydration, so there's no second request.

## useAsyncData: More Flexible Data Fetching

`useFetch` is a wrapper around `useAsyncData`. When you need to call an external SDK or run more complex logic, `useAsyncData` is the better fit.

```vue
<script>
// useAsyncData 接受一个异步函数
const { data: products, pending } = await useAsyncData(
  'products',
  async () => {
    // 可以做任意异步操作
    const category = await getCategoryBySlug(route.params.category)
    const list = await getProductsByCategory(category.id)

    // 组合多个数据源
    return {
      category,
      products: list,
      count: list.length
    }
  },
  {
    watch: [() => route.params.category]
  }
)
</script>
```

## Custom Composables: Encapsulating the Data Layer

In real projects, you shouldn't put API calls directly inside components. It's better to wrap them in a data-layer composable.

```javascript
// composables/useArticle.js
export const useArticle = (id) => {
  const config = useRuntimeConfig()

  return useAsyncData(`article-${id}`, async () => {
    const article = await $fetch(`${config.public.apiBase}/articles/${id}`, {
      headers: {
        Authorization: `Bearer ${useCookie('token').value}`
      }
    })

    // 同时获取评论
    const comments = await $fetch(`${config.public.apiBase}/articles/${id}/comments`)

    return { ...article, comments }
  })
}

// 组件中使用
// <script>
// const { id } = useRoute().params
// const { data: article, pending } = useArticle(id)
// </script>
```

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 仅服务端可访问
    apiSecret: process.env.API_SECRET,
    // 客户端也可访问
    public: {
      apiBase: process.env.API_BASE || 'https://api.example.com'
    }
  }
})
```

## Controlling SSR Behavior for Data Fetching

By default, Nuxt 3 runs every `useFetch`/`useAsyncData` on the server. You can fine-tune this with the options.

```vue
<script>
// 仅在客户端获取（不参与 SSR）
const { data: chatHistory } = await useFetch('/api/chat', {
  server: false
})

// 不阻塞页面导航（懒加载）
const { data: recommendations } = await useFetch('/api/recommend', {
  lazy: true
})

// 利用 watchEffect 在依赖变化时重新获取
const page = ref(1)
const { data: list } = await useFetch(() => `/api/posts?page=${page.value}`, {
  watch: [page]
})
</script>
```

## Summary

- `[slug]` replaces Vue Router's `:slug` for route parameters; catch-alls use `[...all]`
- `useFetch` handles SSR/CSR data fetching automatically and avoids duplicate requests
- `useAsyncData` is ideal for wrapping complex business logic and supports reactive `watch` dependencies
- Wrap the data layer in composables so components care about *what* data they need, not *how* it's fetched
- `server: false` and `lazy: true` give you precise control over SSR behavior and loading strategy
