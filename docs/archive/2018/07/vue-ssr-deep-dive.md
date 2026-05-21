---
title: "Vue 服务端渲染（SSR）原理深入"
date: 2018-07-10 17:24:31
tags:
  - Vue
readingTime: 2
description: "上半年用 Nuxt.js 做了 SSR 项目，用的时候很顺，但遇到问题不知道从哪下手。这次深入看了 Vue SSR 的原理，整理一下核心机制。"
wordCount: 427
---

上半年用 Nuxt.js 做了 SSR 项目，用的时候很顺，但遇到问题不知道从哪下手。这次深入看了 Vue SSR 的原理，整理一下核心机制。

## SSR 和 CSR 的渲染差异

**CSR（Client-Side Rendering）：**

```
1. 浏览器请求 HTML → 服务器返回空 HTML
2. 浏览器加载 JS → Vue 在客户端执行
3. Vue 创建 VNode → diff → 渲染 DOM
4. 用户看到内容（首屏时间 = JS 执行时间）
```

**SSR（Server-Side Rendering）：**

```
1. 浏览器请求 HTML → 服务器执行 Vue
2. Vue 在服务端生成 HTML 字符串 → 发送给浏览器
3. 浏览器显示 HTML（首屏立即可见）
4. 浏览器加载 JS → Vue "接管"已有 DOM（Hydration）
5. 页面变为交互式 SPA
```

## 核心 API：vue-server-renderer

```javascript
{% raw %}
const Vue = require("vue");
const renderer = require("vue-server-renderer").createRenderer();

const app = new Vue({
  template: `<div>Hello, {{ name }}!</div>`,
  data: { name: "World" },
});

renderer.renderToString(app, (err, html) => {
  console.log(html);
  // <div data-server-rendered="true">Hello, World!</div>
});
{% endraw %}
```

`data-server-rendered="true"` 标记告诉客户端 Vue 这个 DOM 是服务端渲染的，可以复用，不需要重新创建。

## 为什么要分离客户端和服务端入口

SSR 应用需要两个 bundle：

**服务端 bundle**（Node.js 环境）：

- 处理 SSR 渲染请求
- 没有 `window`、`document` 等浏览器 API
- 每次请求都是全新的应用实例（避免状态污染）

**客户端 bundle**（浏览器环境）：

- 正常的 SPA bundle
- 负责接管（Hydrate）服务端渲染的 DOM
- 处理路由跳转、交互等

```javascript
// 应用工厂函数（每次调用返回新实例，避免状态污染）
// app.js
import Vue from "vue";
import App from "./App.vue";
import createRouter from "./router";
import createStore from "./store";

export function createApp() {
  const router = createRouter();
  const store = createStore();

  const app = new Vue({
    router,
    store,
    render: (h) => h(App),
  });

  return { app, router, store };
}
```

```javascript
// entry-server.js
import { createApp } from "./app";

export default (context) => {
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp();

    router.push(context.url);

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents();
      if (!matchedComponents.length) {
        return reject({ code: 404 });
      }

      // 调用组件的 asyncData 获取数据
      Promise.all(
        matchedComponents.map((component) => {
          if (component.asyncData) {
            return component.asyncData({ store, route: router.currentRoute });
          }
        }),
      )
        .then(() => {
          // 把 store 状态内嵌到 HTML（客户端用于初始化）
          context.state = store.state;
          resolve(app);
        })
        .catch(reject);
    }, reject);
  });
};
```

## Hydration：客户端接管

客户端初始化时，Vue 检查服务端渲染的 DOM 是否和虚拟 DOM 匹配。匹配则复用，不重新创建：

```javascript
// entry-client.js
import { createApp } from "./app";

const { app, router, store } = createApp();

// 从服务端内嵌的状态初始化 store
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__);
}

router.onReady(() => {
  app.$mount("#app"); // 挂载到已有 DOM，触发 Hydration
});
```

## 常见问题

### 1. 在 SSR 中使用 window/document

```javascript
// ❌ 服务端没有 window
if (window.innerWidth < 768) { ... }

// ✅ 判断运行环境
if (typeof window !== 'undefined') {
  // 只在浏览器中执行
}

// ✅ 或者放在 mounted（只在客户端执行）
mounted() {
  if (window.innerWidth < 768) { ... }
}
```

### 2. Hydration 不匹配

服务端和客户端渲染结果不一致会导致 Hydration 警告：

```vue
{% raw %}
<!-- ❌ 依赖客户端状态的内容 -->
<template>
  <div>{{ Date.now() }}</div>
  <!-- 服务端和客户端时间不同 -->
</template>

<!-- ✅ 确保一致性 -->
<template>
  <div>{{ formattedDate }}</div>
</template>
<script>
export default {
  asyncData({ store }) {
    store.commit("SET_TIMESTAMP", Date.now());
  },
};
</script>
{% endraw %}
```

### 3. 第三方库兼容性

很多库假设浏览器环境，在 SSR 里会报错。解决方式：

- 用条件判断跳过服务端执行
- 使用 `ssr: false` 的插件（Nuxt.js）

## 小结

- SSR 的核心是：服务端渲染 HTML 字符串 + 客户端 Hydration
- 应用必须写成工厂函数，每次请求独立实例
- `asyncData` 在服务端和客户端都能执行，用于数据预取
- 服务端没有浏览器 API，需要做环境判断
- 复杂度高，不是所有项目都需要 SSR，SEO 要求高的内容站适合用
