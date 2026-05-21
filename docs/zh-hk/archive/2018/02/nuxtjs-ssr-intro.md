---
title: "Nuxt.js 服務端渲染入門：為什麼需要 SSR"
date: 2018-02-08 09:53:07
tags:
  - Vue
readingTime: 2
description: "最近用 Nuxt.js 做了一個需要 SEO 的項目，整理一下 SSR 的基本概念和 Nuxt 的核心用法。"
wordCount: 462
---

最近用 Nuxt.js 做了一個需要 SEO 的項目，整理一下 SSR 的基本概念和 Nuxt 的核心用法。

## 為什麼需要 SSR

標準的 Vue SPA 是這樣工作的：

```
瀏覽器請求頁面
→ 服務器返回空 HTML（只有 <div id="app"></div>）
→ 瀏覽器下載 JS bundle
→ Vue 在客户端渲染，填充內容
→ 用户看到頁面
```

這帶來兩個問題：

1. **SEO 差**：搜索引擎爬蟲拿到的是空 HTML，看不到內容
2. **首屏慢**：用户需要等 JS 下載執行完才能看到內容

SSR 解決方案：

```
瀏覽器請求頁面
→ 服務器運行 Vue，生成完整 HTML
→ 返回有內容的 HTML
→ 用户立即看到頁面（首屏快）
→ JS 加載完成，Vue 接管（Hydration）
→ 頁面變成正常的 SPA
```

## Nuxt.js 是什麼

Nuxt.js 是基於 Vue 的 SSR 框架，解決了 SSR 的複雜配置問題：

- 自動路由（基於文件結構）
- 內置 Vuex 集成
- 自動代碼分割
- 支持靜態站點生成（SSG）

## 項目結構

```
nuxt-app/
├── pages/          ← 頁面組件，自動生成路由
│   ├── index.vue   → /
│   ├── about.vue   → /about
│   └── users/
│       └── _id.vue → /users/:id
├── layouts/        ← 佈局模板
│   └── default.vue
├── components/     ← 普通組件
├── store/          ← Vuex store
├── static/         ← 靜態文件
├── assets/         ← 需要處理的資源
└── nuxt.config.js  ← 配置文件
```

## 核心概念：asyncData

SSR 的關鍵 hook，在服務端獲取數據：

```vue
{% raw %}
<template>
  <div>
    <h1>{{ post.title }}</h1>
    <p>{{ post.content }}</p>
  </div>
</template>

<script>
import axios from "axios";

export default {
  async asyncData({ params, error }) {
    try {
      const { data } = await axios.get(`/api/posts/${params.id}`);
      return { post: data };
    } catch (e) {
      error({ statusCode: 404, message: "文章不存在" });
    }
  },
};
</script>
{% endraw %}
```

`asyncData` 在服務端執行，返回的數據會和 `data()` 合併。頁面 HTML 裏就包含了這些數據，SEO 能抓到。

注意：`asyncData` 裏**不能用 `this`**（組件還沒實例化），通過參數 `context` 拿路由信息、store 等。

## fetch hook

`fetch` 也在服務端執行，但用於填充 Vuex store：

```vue
<script>
export default {
  async fetch({ store, params }) {
    await store.dispatch("posts/fetchPost", params.id);
  },
};
</script>
```

## 動態路由

文件名用 `_` 前綴表示動態參數：

```
pages/
├── users/
│   ├── index.vue      → /users
│   └── _id.vue        → /users/:id（動態）
```

```vue
<!-- pages/users/_id.vue -->
<script>
export default {
  async asyncData({ params }) {
    const userId = params.id;
    // ...
  },
};
</script>
```

## nuxt.config.js 常用配置

```javascript
module.exports = {
  // 頁面 head 配置
  head: {
    title: "我的網站",
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "網站描述" },
    ],
  },

  // 全局 CSS
  css: ["~/assets/main.scss"],

  // 插件
  plugins: ["~/plugins/axios"],

  // Nuxt 模塊
  modules: ["@nuxtjs/axios"],

  // 構建配置
  build: {
    extend(config, ctx) {
      // 自定義 webpack 配置
    },
  },
};
```

## 靜態站點生成（generate）

如果不需要真正的 SSR，只想生成靜態 HTML（博客場景）：

```bash
npm run generate
```

Nuxt 會在構建時請求所有頁面，生成靜態 HTML 文件，可以部署到 CDN。

```javascript
// nuxt.config.js - 動態路由的靜態生成需要聲明
module.exports = {
  generate: {
    routes: async () => {
      const { data } = await axios.get("/api/posts");
      return data.map((post) => `/posts/${post.id}`);
    },
  },
};
```

## 踩坑：window is not defined

SSR 環境下（Node.js）沒有 `window` 對象，直接用會報錯：

```javascript
// ❌ 這會在服務端報錯
mounted() {
  // mounted 只在客户端執行，這裏是安全的 ✅
  window.addEventListener('resize', this.handleResize)
}

// ❌ 這會報錯
asyncData() {
  const width = window.innerWidth  // 服務端沒有 window！
}
```

對於必須在客户端才能用的庫（比如操作 DOM 的）：

```javascript
// nuxt.config.js
plugins: [
  { src: "~/plugins/some-plugin", ssr: false }, // 只在客户端加載
];
```

## 小結

Nuxt.js 把 SSR 的複雜性封裝得很好，基於約定的文件路由上手快。`asyncData` 是核心，理解它在服務端和客户端都能執行的特性很重要。SEO 要求高的內容站點、電商首頁場景比較適合用。
