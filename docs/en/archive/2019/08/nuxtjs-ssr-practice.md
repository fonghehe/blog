---
title: "Nuxt.js Server-Side Rendering in Practice"
date: 2019-08-29 09:40:58
tags:
  - Vue
readingTime: 2
description: "We built an e-commerce site that needed good SEO and a fast first paint. After evaluating the options, we chose Nuxt.js for Vue SSR."
wordCount: 160
---

We built an e-commerce site that needed good SEO and a fast first paint. After evaluating the options, we chose Nuxt.js for Vue SSR.

## What Is Nuxt.js

If Next.js is to React, Nuxt.js is to Vue. It provides:

- Convention-based routing (files are routes)
- Server-side rendering (SSR)
- Static site generation (SSG)
- Automatic code splitting

## Project Structure

```
pages/
  index.vue          → /
  products/
    index.vue        → /products
    _id.vue          → /products/:id（动态路由）
  about.vue          → /about
layouts/
  default.vue        → 默认布局
  admin.vue          → 后台布局
components/
store/
  index.js           → Vuex
nuxt.config.js       → 配置文件
```

## Data Fetching

```vue
{% raw %}
<!-- pages/products/_id.vue -->
<template>
  <div>
    <h1>{{ product.name }}</h1>
    <p>{{ product.description }}</p>
    <p>价格：¥{{ product.price }}</p>
  </div>
</template>

<script>
export default {
  // asyncData：服务端执行，数据直接合并到 data
  async asyncData({ params, $axios, error }) {
    try {
      const product = await $axios.$get(`/api/products/${params.id}`);
      return { product };
    } catch (e) {
      error({ statusCode: 404, message: "商品不存在" });
    }
  },

  // fetch：更灵活，可以更新 Vuex store
  async fetch() {
    await this.$store.dispatch("cart/loadCartItems");
  },

  // head：设置页面 meta 标签（SEO 关键！）
  head() {
    return {
      title: this.product.name,
      meta: [
        {
          hid: "description",
          name: "description",
          content: this.product.description,
        },
        { property: "og:title", content: this.product.name },
        { property: "og:image", content: this.product.image },
      ],
    };
  },
};
</script>
{% endraw %}
```

## nuxt.config.js Key Configuration

```javascript
export default {
  mode: "universal", // SSR 模式（'spa' 是纯前端）

  // 全局 CSS
  css: ["~/assets/styles/main.scss"],

  // 插件（区分客户端/服务端）
  plugins: [
    "~/plugins/axios.js",
    { src: "~/plugins/chart.js", mode: "client" }, // 只在客户端加载
  ],

  // 模块
  modules: [
    "@nuxtjs/axios",
    "@nuxtjs/pwa", // PWA 支持
  ],

  // axios 基础配置
  axios: {
    baseURL: process.env.API_URL || "http://localhost:3000",
  },

  // 构建优化
  build: {
    extractCSS: true, // CSS 单独提取（更好的缓存）
    optimizeCSS: true,
    babel: {
      plugins: ["lodash"], // lodash tree-shaking
    },
  },

  // 渲染优化
  render: {
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ["script", "style", "font"].includes(type);
      },
    },
  },
};
```

## Static Generation (SEO + CDN)

```javascript
// nuxt.config.js
export default {
  generate: {
    // 动态路由：告诉 Nuxt 要生成哪些页面
    routes: async () => {
      const products = await axios.get("/api/products?all=true");
      return products.data.map((p) => `/products/${p.id}`);
    },
  },
};
```

```bash
npm run generate  # 生成静态 HTML 到 dist/
# 直接上传 CDN，速度极快
```

## Deployment

```dockerfile
# Dockerfile（SSR 模式）
FROM node:12-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## Common Pitfalls

1. **window is not defined**: the SSR environment has no `window`; guard with `process.client`.
2. **Third-party libraries that don't support SSR**: load them via a `mode: 'client'` plugin or a dynamic import.
3. **Cookies**: server-side requests must forward cookies; use `@nuxtjs/proxy` to handle cross-origin requests.

## Summary

- `asyncData` runs on the server, and its returned data is merged into `data` and used for rendering directly.
- The dynamic route `_id.vue` maps to the `:id` parameter.
- The `head()` method sets SEO-related meta tags.
- Static generation suits pages whose content rarely changes; SSR suits real-time data.
