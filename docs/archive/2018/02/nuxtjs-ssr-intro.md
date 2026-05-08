---
title: "Nuxt.js 服务端渲染入门：为什么需要 SSR"
date: 2018-02-08 09:53:07
tags:
  - Vue
---

最近用 Nuxt.js 做了一个需要 SEO 的项目，整理一下 SSR 的基本概念和 Nuxt 的核心用法。

## 为什么需要 SSR

标准的 Vue SPA 是这样工作的：

```
浏览器请求页面
→ 服务器返回空 HTML（只有 <div id="app"></div>）
→ 浏览器下载 JS bundle
→ Vue 在客户端渲染，填充内容
→ 用户看到页面
```

这带来两个问题：

1. **SEO 差**：搜索引擎爬虫拿到的是空 HTML，看不到内容
2. **首屏慢**：用户需要等 JS 下载执行完才能看到内容

SSR 解决方案：

```
浏览器请求页面
→ 服务器运行 Vue，生成完整 HTML
→ 返回有内容的 HTML
→ 用户立即看到页面（首屏快）
→ JS 加载完成，Vue 接管（Hydration）
→ 页面变成正常的 SPA
```

## Nuxt.js 是什么

Nuxt.js 是基于 Vue 的 SSR 框架，解决了 SSR 的复杂配置问题：

- 自动路由（基于文件结构）
- 内置 Vuex 集成
- 自动代码分割
- 支持静态站点生成（SSG）

## 项目结构

```
nuxt-app/
├── pages/          ← 页面组件，自动生成路由
│   ├── index.vue   → /
│   ├── about.vue   → /about
│   └── users/
│       └── _id.vue → /users/:id
├── layouts/        ← 布局模板
│   └── default.vue
├── components/     ← 普通组件
├── store/          ← Vuex store
├── static/         ← 静态文件
├── assets/         ← 需要处理的资源
└── nuxt.config.js  ← 配置文件
```

## 核心概念：asyncData

SSR 的关键 hook，在服务端获取数据：

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

`asyncData` 在服务端执行，返回的数据会和 `data()` 合并。页面 HTML 里就包含了这些数据，SEO 能抓到。

注意：`asyncData` 里**不能用 `this`**（组件还没实例化），通过参数 `context` 拿路由信息、store 等。

## fetch hook

`fetch` 也在服务端执行，但用于填充 Vuex store：

```vue
<script>
export default {
  async fetch({ store, params }) {
    await store.dispatch("posts/fetchPost", params.id);
  },
};
</script>
```

## 动态路由

文件名用 `_` 前缀表示动态参数：

```
pages/
├── users/
│   ├── index.vue      → /users
│   └── _id.vue        → /users/:id（动态）
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
  // 页面 head 配置
  head: {
    title: "我的网站",
    meta: [
      { charset: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "网站描述" },
    ],
  },

  // 全局 CSS
  css: ["~/assets/main.scss"],

  // 插件
  plugins: ["~/plugins/axios"],

  // Nuxt 模块
  modules: ["@nuxtjs/axios"],

  // 构建配置
  build: {
    extend(config, ctx) {
      // 自定义 webpack 配置
    },
  },
};
```

## 静态站点生成（generate）

如果不需要真正的 SSR，只想生成静态 HTML（博客场景）：

```bash
npm run generate
```

Nuxt 会在构建时请求所有页面，生成静态 HTML 文件，可以部署到 CDN。

```javascript
// nuxt.config.js - 动态路由的静态生成需要声明
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

SSR 环境下（Node.js）没有 `window` 对象，直接用会报错：

```javascript
// ❌ 这会在服务端报错
mounted() {
  // mounted 只在客户端执行，这里是安全的 ✅
  window.addEventListener('resize', this.handleResize)
}

// ❌ 这会报错
asyncData() {
  const width = window.innerWidth  // 服务端没有 window！
}
```

对于必须在客户端才能用的库（比如操作 DOM 的）：

```javascript
// nuxt.config.js
plugins: [
  { src: "~/plugins/some-plugin", ssr: false }, // 只在客户端加载
];
```

## 小结

Nuxt.js 把 SSR 的复杂性封装得很好，基于约定的文件路由上手快。`asyncData` 是核心，理解它在服务端和客户端都能执行的特性很重要。SEO 要求高的内容站点、电商首页场景比较适合用。
