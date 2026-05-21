---
title: "2022 年前端：Vue 3 即将成为默认，Vite 已是标配"
date: 2022-01-01 09:31:57
tags:
  - Vue
readingTime: 2
description: "新年伊始，前端生态正在完成一次安静但重要的切换。Vue 3 预计在 2022 年第一季度成为 `npm install vue` 的默认版本，Vite 2 已经是大多数新项目的构建工具首选，React 18 正式版也近在眼前。这篇文章梳理 2021 年底前端格局，展望 2022 年的关键节点。"
wordCount: 455
---

新年伊始，前端生态正在完成一次安静但重要的切换。Vue 3 预计在 2022 年第一季度成为 `npm install vue` 的默认版本，Vite 2 已经是大多数新项目的构建工具首选，React 18 正式版也近在眼前。这篇文章梳理 2021 年底前端格局，展望 2022 年的关键节点。

## Vue 3 生态补完情况

截至 2022 年初，Vue 3 生态缺口基本补齐：

```bash
# Vue 3 推荐技术栈（2022 年初）
vue@3.2          # Composition API + <script setup> 稳定
pinia@2          # 官方推荐状态管理（替代 Vuex）
vue-router@4     # 支持 Composition API 路由
vite@2           # 官方推荐构建工具
vitest@0.x       # Vite 驱动的测试框架（早期）
```

`<script setup>` 已在 Vue 3.2 正式稳定，不再是实验性语法：

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

## Pinia 取代 Vuex 的时机

Vuex 5（专为 Vue 3 设计）开发陷入停滞，官方转而推荐 Pinia：

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

对比 Vuex 4，Pinia 的优势：

- 无 mutations，直接修改 state
- TypeScript 类型推断开箱即用
- DevTools 支持完善
- Bundle 体积约 1.5KB（vs Vuex ~10KB）

## Vite 2 已成熟到生产可用

2021 年的实践验证了 Vite 2 可以用于生产大型项目：

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

## React 18 正式版在路上

React 18 从 2021 年 6 月发布 Alpha，已历经半年打磨。2022 年正式版将带来：

- 自动批处理（Automatic Batching）
- `useTransition` 和 `useDeferredValue`
- Streaming SSR（`renderToPipeableStream`）
- `<Suspense>` 支持异步数据（非仅懒加载组件）

## 2022 值得关注的方向

| 方向       | 代表技术                      | 预判                |
| 
---------- | ----------------------------- | ------------------- |
| 构建工具   | Vite 3、Turbopack（Vercel）   | Vite 持续成为首选   |
| 全栈框架   | Next.js 13、Nuxt 3、SvelteKit | 元框架竞争加剧      |
| 状态管理   | Pinia、Zustand、Jotai         | 轻量化、原子化趋势  |
| 测试       | Vitest、Playwright            | Vitest 快速扩大份额 |
| TypeScript | TS 4.6、4.7、4.8              | 每版本都有实用改进  |

## 总结

2022 年的前端"战场"已经清晰：Vue 3 完成新老交替，React 18 并发渲染落地，Vite 生态持续扩张。对开发者来说，现在是迁移到 Vue 3 + Pinia + Vite 组合的最佳时机，而 React 项目则值得尽早体验 18 的并发特性。