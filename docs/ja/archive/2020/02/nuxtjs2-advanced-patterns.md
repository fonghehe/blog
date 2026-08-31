---
title: "Nuxt.js 3：新しいルーティングとデータ取得方法"
date: 2020-02-14 10:26:37
tags:
  - Vue
readingTime: 3
description: "Nuxt.js は Vue のメタフレームワークとして SSR エコシステムで主導的な地位を占めている。Nuxt 3 は Vue 3 をベースに全面再構築され、Composition API 駆動のデータ取得と新しいディレクトリ規約を導入した。本記事では Nuxt 3 のルーティングシステムとデータ取得の核心的な変化を紹介する。"
wordCount: 675
---

Nuxt.js は Vue のメタフレームワークとして SSR エコシステムで主导地位を占めている。Nuxt 3 は Vue 3 ベースに全面再構築され、Composition API 駆動のデータ取得アプローチと新しいディレクトリ規約を導入した。本記事では Nuxt 3 のルーティングシステムとデータ取得の中心的な変化を紹介する。

## ファイルベースのルーティングシステム

Nuxt 3 は「ファイルがそのままルートになる」という規約を引き継いでいるが、ルートパラメータの記法が調整された。

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

注意点：`[slug]` はパラメータを角括弧で囲む。`[...all]` は catch-all ルート、`[[optional]]` は省略可能なパラメータである。

## useFetch：Composition APIによるデータ取得

Nuxt 3 では、Options API スタイルの `asyncData` や `fetch` の代わりに `useFetch` が使われる。

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

`useFetch` は SSR 時にサーバー側で実行され、データをクライアントの hydration に自動注入するため、二重のリクエストは発生しない。

## useAsyncData：より柔軟なデータ取得

`useFetch` は `useAsyncData` のラッパーである。外部 SDK の呼び出しや複雑なロジックの実行が必要な場合は、`useAsyncData` を使う方が適している。

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

## カスタム composable：データ層の分離

実際のプロジェクトでは、コンポーネント内に直接 API 呼び出しを書くべきではない。データ層は composable に切り出すことを推奨する。

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

## データ取得の SSR 挙動制御

Nuxt 3 はデフォルトで全ての `useFetch`/`useAsyncData` をサーバー側で実行する。オプションで精緻に制御できる。

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

## まとめ

- `[slug]` のルートパラメータ構文は Vue Router の `:slug` に代わるもので、catch-all には `[...all]` を使う
- `useFetch` は SSR/CSR のデータ取得を自動処理し、重複リクエストを防ぐ
- `useAsyncData` は複雑なビジネスロジックの分離に適しており、`watch` によるリアクティブな依存関係をサポートする
- データ層は composables でカプセル化し、コンポーネントは「どのデータを使うか」だけに集中して「どう取得するか」は気にしない
- `server: false` と `lazy: true` で SSR の挙動とロード戦略を精密に制御できる
