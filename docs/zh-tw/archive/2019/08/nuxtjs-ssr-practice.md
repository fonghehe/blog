---
title: "Nuxt.js 服務端渲染實戰"
date: 2019-08-29 09:40:58
tags:
  - Vue
readingTime: 2
description: "做了一個電商官網，要求 SEO 和首屏速度。調研了 Nuxt.js，最終選它做 Vue SSR。"
wordCount: 212
---

做了一個電商官網，要求 SEO 和首屏速度。調研了 Nuxt.js，最終選它做 Vue SSR。

## Nuxt.js 是什麼

Next.js 對應 React，Nuxt.js 對應 Vue。提供：

- 約定式路由（檔案即路由）
- 服務端渲染（SSR）
- 靜態生成（SSG）
- 自動程式碼分割

## 專案結構

```
pages/
  index.vue          → /
  products/
    index.vue        → /products
    _id.vue          → /products/:id（動態路由）
  about.vue          → /about
layouts/
  default.vue        → 預設佈局
  admin.vue          → 後臺佈局
components/
store/
  index.js           → Vuex
nuxt.config.js       → 配置檔案
```

## 資料獲取

```vue
{% raw %}
<!-- pages/products/_id.vue -->
<template>
  <div>
    <h1>{{ product.name }}</h1>
    <p>{{ product.description }}</p>
    <p>價格：¥{{ product.price }}</p>
  </div>
</template>

<script>
export default {
  // asyncData：服務端執行，資料直接合併到 data
  async asyncData({ params, $axios, error }) {
    try {
      const product = await $axios.$get(`/api/products/${params.id}`);
      return { product };
    } catch (e) {
      error({ statusCode: 404, message: "商品不存在" });
    }
  },

  // fetch：更靈活，可以更新 Vuex store
  async fetch() {
    await this.$store.dispatch("cart/loadCartItems");
  },

  // head：設定頁面 meta 標籤（SEO 關鍵！）
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

## nuxt.config.js 關鍵設定

```javascript
export default {
  mode: "universal", // SSR 模式（'spa' 是純前端）

  // 全域性 CSS
  css: ["~/assets/styles/main.scss"],

  // 外掛（區分客戶端/服務端）
  plugins: [
    "~/plugins/axios.js",
    { src: "~/plugins/chart.js", mode: "client" }, // 隻在客戶端載入
  ],

  // 模組
  modules: [
    "@nuxtjs/axios",
    "@nuxtjs/pwa", // PWA 支援
  ],

  // axios 基礎配置
  axios: {
    baseURL: process.env.API_URL || "http://localhost:3000",
  },

  // 構建最佳化
  build: {
    extractCSS: true, // CSS 單獨提取（更好的快取）
    optimizeCSS: true,
    babel: {
      plugins: ["lodash"], // lodash tree-shaking
    },
  },

  // 渲染最佳化
  render: {
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ["script", "style", "font"].includes(type);
      },
    },
  },
};
```

## 靜態生成（SEO + CDN）

```javascript
// nuxt.config.js
export default {
  generate: {
    // 動態路由：告訴 Nuxt 要生成哪些頁面
    routes: async () => {
      const products = await axios.get("/api/products?all=true");
      return products.data.map((p) => `/products/${p.id}`);
    },
  },
};
```

```bash
npm run generate  # 生成靜態 HTML 到 dist/
# 直接上傳 CDN，速度極快
```

## 部署

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

## 踩坑記錄

1. **window is not defined**：SSR 環境沒有 `window`，用 `process.client` 判斷
2. **第三方庫不支援 SSR**：用 `mode: 'client'` 外掛或動態匯入
3. **cookies**：服務端請求要轉發 cookie，用 `@nuxtjs/proxy` 解決跨域

## 小結

- `asyncData` 在服務端執行，返回的資料合併到 data，直接用於渲染
- 動態路由 `_id.vue` 對應 `:id` 引數
- `head()` 方法設定 SEO meta 標籤
- 靜態生成適合內容不常變的頁面，SSR 適合即時資料
