---
title: "Nuxt.js 3 路由與數據獲取新方案：落地路徑與實戰建議"
date: 2020-02-14 10:26:37
tags:
  - Vue
readingTime: 2
description: "Nuxt.js 作為 Vue 的元框架，在 SSR 生態中佔據主導地位。Nuxt 3 基於 Vue 3 全面重構，引入了 Composition API 驅動的數據獲取方案和新的目錄約定。本文介紹 Nuxt 3 中路由系統和數據獲取的核心變化。"
wordCount: 397
---

Nuxt.js 作為 Vue 的元框架，在 SSR 生態中佔據主導地位。Nuxt 3 基於 Vue 3 全面重構，引入了 Composition API 驅動的數據獲取方案和新的目錄約定。本文介紹 Nuxt 3 中路由系統和數據獲取的核心變化。

## 基於檔案的路由系統

Nuxt 3 延續了文件即路由的約定，但路由參數的語法有所調整。

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
└── [[optional]].vue     ->  /:optional? (可選參數)
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

注意 `[slug]` 用方括號包裹參數。`[...all]` 是 catch-all 路由，`[[optional]]` 是可選參數。

## useFetch：Composition API 驅動的數據獲取

Nuxt 3 用 `useFetch` 取代了 Options API 風格的 `asyncData` 和 `fetch`。

```vue
<script>
// 基礎用法：自動推斷 URL
const { data: users, pending, error, refresh } = await useFetch('/api/users')

// 帶配置
const { data: post } = await useFetch('/api/posts/1', {
  key: 'post-detail',   // 緩存 key，防止重複請求
  pick: ['id', 'title', 'content'],  // 隻取需要的字段，減小包體
  lazy: true,            // 不阻塞導航
  server: false,         // 僅客户端請求
  transform: (data) => {
    // 數據轉換
    return {
      ...data,
      createdAt: new Date(data.createdAt).toLocaleDateString('zh-CN')
    }
  },
  watch: [route.params.id], // 監聽變化自動重新請求
  initialCache: false,       // 禁用初始緩存
})

// POST 請求
const { data: result } = await useFetch('/api/posts', {
  method: 'POST',
  body: { title: '新文章', content: '內容...' }
})
</script>
```

`useFetch` 在 SSR 時會在服務端執行，自動將數據注入到客户端 hydration 中，不會產生二次請求。

## useAsyncData：更靈活的數據獲取

`useFetch` 是 `useAsyncData` 的封裝。當需要調用外部 SDK 或執行復雜邏輯時，用 `useAsyncData` 更合適。

```vue
<script>
// useAsyncData 接受一個異步函數
const { data: products, pending } = await useAsyncData(
  'products',
  async () => {
    // 可以做任意異步操作
    const category = await getCategoryBySlug(route.params.category)
    const list = await getProductsByCategory(category.id)

    // 組合多個數據源
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

## 自定義 composable：封裝數據層

實際項目中，不應該在組件裏直接寫 API 調用。推薦封裝數據層 composable。

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

    // 同時獲取評論
    const comments = await $fetch(`${config.public.apiBase}/articles/${id}/comments`)

    return { ...article, comments }
  })
}

// 組件中使用
// <script>
// const { id } = useRoute().params
// const { data: article, pending } = useArticle(id)
// </script>
```

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 僅服務端可訪問
    apiSecret: process.env.API_SECRET,
    // 客户端也可訪問
    public: {
      apiBase: process.env.API_BASE || 'https://api.example.com'
    }
  }
})
```

## 數據獲取的 SSR 行為控製

Nuxt 3 默認在服務端執行所有 `useFetch`/`useAsyncData`。可以通過選項精確控製。

```vue
<script>
// 僅在客户端獲取（不參與 SSR）
const { data: chatHistory } = await useFetch('/api/chat', {
  server: false
})

// 不阻塞頁面導航（懶加載）
const { data: recommendations } = await useFetch('/api/recommend', {
  lazy: true
})

// 利用 watchEffect 在依賴變化時重新獲取
const page = ref(1)
const { data: list } = await useFetch(() => `/api/posts?page=${page.value}`, {
  watch: [page]
})
</script>
```

## 小結

- `[slug]` 路由參數語法替代了 Vue Router 的 `:slug`，catch-all 用 `[...all]`
- `useFetch` 自動處理 SSR/CSR 數據獲取，避免重複請求
- `useAsyncData` 適合封裝複雜業務邏輯，支持 `watch` 響應式依賴
- 數據層用 composables 封裝，組件隻關心"用什麼數據"而不關心"怎麼拿"
- `server: false` 和 `lazy: true` 精確控製 SSR 行為和加載策略
