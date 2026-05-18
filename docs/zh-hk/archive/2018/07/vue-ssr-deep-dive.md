---
title: "Vue 服務端渲染（SSR）原理深入"
date: 2018-07-10 17:24:31
tags:
  - Vue
readingTime: 2
description: "上半年用 Nuxt.js 做了 SSR 項目，用的時候很順，但遇到問題不知道從哪下手。這次深入看了 Vue SSR 的原理，整理一下核心機制。"
---

上半年用 Nuxt.js 做了 SSR 項目，用的時候很順，但遇到問題不知道從哪下手。這次深入看了 Vue SSR 的原理，整理一下核心機制。

## SSR 和 CSR 的渲染差異

**CSR（Client-Side Rendering）：**

```
1. 瀏覽器請求 HTML → 服務器返回空 HTML
2. 瀏覽器加載 JS → Vue 在客户端執行
3. Vue 創建 VNode → diff → 渲染 DOM
4. 用户看到內容（首屏時間 = JS 執行時間）
```

**SSR（Server-Side Rendering）：**

```
1. 瀏覽器請求 HTML → 服務器執行 Vue
2. Vue 在服務端生成 HTML 字符串 → 發送給瀏覽器
3. 瀏覽器顯示 HTML（首屏立即可見）
4. 瀏覽器加載 JS → Vue "接管"已有 DOM（Hydration）
5. 頁面變為交互式 SPA
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

`data-server-rendered="true"` 標記告訴客户端 Vue 這個 DOM 是服務端渲染的，可以複用，不需要重新創建。

## 為什麼要分離客户端和服務端入口

SSR 應用需要兩個 bundle：

**服務端 bundle**（Node.js 環境）：

- 處理 SSR 渲染請求
- 沒有 `window`、`document` 等瀏覽器 API
- 每次請求都是全新的應用實例（避免狀態污染）

**客户端 bundle**（瀏覽器環境）：

- 正常的 SPA bundle
- 負責接管（Hydrate）服務端渲染的 DOM
- 處理路由跳轉、交互等

```javascript
// 應用工廠函數（每次調用返回新實例，避免狀態污染）
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

      // 調用組件的 asyncData 獲取數據
      Promise.all(
        matchedComponents.map((component) => {
          if (component.asyncData) {
            return component.asyncData({ store, route: router.currentRoute });
          }
        }),
      )
        .then(() => {
          // 把 store 狀態內嵌到 HTML（客户端用於初始化）
          context.state = store.state;
          resolve(app);
        })
        .catch(reject);
    }, reject);
  });
};
```

## Hydration：客户端接管

客户端初始化時，Vue 檢查服務端渲染的 DOM 是否和虛擬 DOM 匹配。匹配則複用，不重新創建：

```javascript
// entry-client.js
import { createApp } from "./app";

const { app, router, store } = createApp();

// 從服務端內嵌的狀態初始化 store
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__);
}

router.onReady(() => {
  app.$mount("#app"); // 掛載到已有 DOM，觸發 Hydration
});
```

## 常見問題

### 1. 在 SSR 中使用 window/document

```javascript
// ❌ 服務端沒有 window
if (window.innerWidth < 768) { ... }

// ✅ 判斷運行環境
if (typeof window !== 'undefined') {
  // 只在瀏覽器中執行
}

// ✅ 或者放在 mounted（只在客户端執行）
mounted() {
  if (window.innerWidth < 768) { ... }
}
```

### 2. Hydration 不匹配

服務端和客户端渲染結果不一致會導致 Hydration 警告：

```vue
{% raw %}
<!-- ❌ 依賴客户端狀態的內容 -->
<template>
  <div>{{ Date.now() }}</div>
  <!-- 服務端和客户端時間不同 -->
</template>

<!-- ✅ 確保一致性 -->
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

### 3. 第三方庫兼容性

很多庫假設瀏覽器環境，在 SSR 裏會報錯。解決方式：

- 用條件判斷跳過服務端執行
- 使用 `ssr: false` 的插件（Nuxt.js）

## 小結

- SSR 的核心是：服務端渲染 HTML 字符串 + 客户端 Hydration
- 應用必須寫成工廠函數，每次請求獨立實例
- `asyncData` 在服務端和客户端都能執行，用於數據預取
- 服務端沒有瀏覽器 API，需要做環境判斷
- 複雜度高，不是所有項目都需要 SSR，SEO 要求高的內容站適合用
