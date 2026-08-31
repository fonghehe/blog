---
title: "2022 Frontend: Vue 3 Becomes the Default, Vite is Now Standard"
date: 2022-01-01 09:31:57
tags:
  - Vue
readingTime: 2
description: "As the new year begins, the frontend ecosystem is completing a quiet but important switch. Vue 3 is expected to become the default version of `npm install vue` "
wordCount: 342
---

As the new year begins, the frontend ecosystem is completing a quiet but important switch. Vue 3 is expected to become the default version of `npm install vue` in Q1 2022, Vite 2 is already the preferred build tool for most new projects, and React 18 official release is imminent. This article reviews the frontend landscape at the end of 2021 and looks ahead to key milestones in 2022.

## Vue 3 Ecosystem: Complete Catch-Up

By early 2022, the gaps in the Vue 3 ecosystem had largely been filled:

```bash
# Vue 3 推荐技术栈（2022 年初）
vue@3.2          # Composition API + <script setup> 稳定
pinia@2          # 官方推荐状态管理（替代 Vuex）
vue-router@4     # 支持 Composition API 路由
vite@2           # 官方推荐构建工具
vitest@0.x       # Vite 驱动的测试框架（早期）
```

`<script setup>` has been officially stabilized in Vue 3.2 and is no longer experimental syntax:

```vue
<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const userStore = useUserStore();

const count = ref(0);
const doubled = computed(() => count.value * 2);

async function logout() {
  await userStore.logout();
  router.push("/login");
}
</script>

<template>
  <div>
    <p>Count: {{ count }}, Doubled: {{ doubled }}</p>
    <button @click="logout">退出登录</button>
  </div>
</template>
```

## The Right Time for Pinia to Replace Vuex

Vuex 5 (designed specifically for Vue 3) development stalled, and the official team switched to recommending Pinia:

```typescript
// stores/cart.ts
import { defineStore } from "pinia";

export const useCartStore = defineStore("cart", () => {
  const items = ref<CartItem[]>([]);

  const total = computed(() =>
    items.value.reduce((sum, item) => sum + item.price * item.qty, 0),
  );

  async function addItem(product: Product) {
    const existing = items.value.find((i) => i.id === product.id);
    if (existing) {
      existing.qty++;
    } else {
      items.value.push({ ...product, qty: 1 });
    }
  }

  return { items, total, addItem };
});
```

Compared with Vuex 4, Pinia's advantages are:

- No mutations; state is modified directly
- TypeScript type inference works out of the box
- Full DevTools support
- Bundle size is about 1.5KB (vs Vuex ~10KB)

## Vite 2 Is Production-Ready

Our experience in 2021 confirmed that Vite 2 is production-ready even for large projects:

```javascript
// vite.config.ts（2022 年常见配置）
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    target: "es2015",
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": ["vue", "vue-router", "pinia"],
          "ui-vendor": ["element-plus"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

## React 18 Official Release on the Way

React 18 has been refined for half a year since its Alpha release in June 2021. The 2022 stable release will bring:

- Automatic Batching
- `useTransition` and `useDeferredValue`
- Streaming SSR (`renderToPipeableStream`)
- `<Suspense>` supporting async data (not just lazy-loaded components)

## Directions Worth Watching in 2022

| Area | Representative Tech | Outlook |
| ---------- | ----------------------------- | ------------------- |
| Build tools | Vite 3, Turbopack (Vercel) | Vite remains the top choice |
| Full-stack frameworks | Next.js 13, Nuxt 3, SvelteKit | Metaframework competition intensifies |
| State management | Pinia, Zustand, Jotai | Trend toward lightweight, atomic solutions |
| Testing | Vitest, Playwright | Vitest rapidly gaining share |
| TypeScript | TS 4.6, 4.7, 4.8 | Each release brings practical improvements |

## Summary

The frontend "battlefield" of 2022 is already clear: Vue 3 has completed its handover from the old to the new, React 18's concurrent rendering has landed, and the Vite ecosystem keeps expanding. For developers, now is the best time to migrate to the Vue 3 + Pinia + Vite stack, while React projects are worth trying out 18's concurrent features early.