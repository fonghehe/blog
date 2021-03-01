---
title: "Nuxt.js 服务端渲染实战"
date: 2019-08-29 09:40:58
tags:
  - Vue
---

做了一个电商官网，要求 SEO 和首屏速度。调研了 Nuxt.js，最终选它做 Vue SSR。

## Nuxt.js 是什么

Next.js 对应 React，Nuxt.js 对应 Vue。提供：

- 约定式路由（文件即路由）
- 服务端渲染（SSR）
- 静态生成（SSG）
- 自动代码分割

## 项目结构

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

## 数据获取

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

## nuxt.config.js 关键配置

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

## 静态生成（SEO + CDN）

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

## 踩坑记录

1. **window is not defined**：SSR 环境没有 `window`，用 `process.client` 判断
2. **第三方库不支持 SSR**：用 `mode: 'client'` 插件或动态导入
3. **cookies**：服务端请求要转发 cookie，用 `@nuxtjs/proxy` 解决跨域

## 小结

- `asyncData` 在服务端执行，返回的数据合并到 data，直接用于渲染
- 动态路由 `_id.vue` 对应 `:id` 参数
- `head()` 方法设置 SEO meta 标签
- 静态生成适合内容不常变的页面，SSR 适合实时数据
