---
title: "Nuxt.js 3 路由与数据获取新方案"
date: 2020-02-14 10:26:37
tags:
  - Vue
---

Nuxt.js 作为 Vue 的元框架，在 SSR 生态中占据主导地位。Nuxt 3 基于 Vue 3 全面重构，引入了 Composition API 驱动的数据获取方案和新的目录约定。本文介绍 Nuxt 3 中路由系统和数据获取的核心变化。

## 基于文件的路由系统

Nuxt 3 延续了文件即路由的约定，但路由参数的语法有所调整。

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

注意 `[slug]` 用方括号包裹参数。`[...all]` 是 catch-all 路由，`[[optional]]` 是可选参数。

## useFetch：Composition API 驱动的数据获取

Nuxt 3 用 `useFetch` 取代了 Options API 风格的 `asyncData` 和 `fetch`。

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

`useFetch` 在 SSR 时会在服务端执行，自动将数据注入到客户端 hydration 中，不会产生二次请求。

## useAsyncData：更灵活的数据获取

`useFetch` 是 `useAsyncData` 的封装。当需要调用外部 SDK 或执行复杂逻辑时，用 `useAsyncData` 更合适。

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

## 自定义 composable：封装数据层

实际项目中，不应该在组件里直接写 API 调用。推荐封装数据层 composable。

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

## 数据获取的 SSR 行为控制

Nuxt 3 默认在服务端执行所有 `useFetch`/`useAsyncData`。可以通过选项精确控制。

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

## 小结

- `[slug]` 路由参数语法替代了 Vue Router 的 `:slug`，catch-all 用 `[...all]`
- `useFetch` 自动处理 SSR/CSR 数据获取，避免重复请求
- `useAsyncData` 适合封装复杂业务逻辑，支持 `watch` 响应式依赖
- 数据层用 composables 封装，组件只关心"用什么数据"而不关心"怎么拿"
- `server: false` 和 `lazy: true` 精确控制 SSR 行为和加载策略
