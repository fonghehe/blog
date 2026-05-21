---
title: "2022 年前端：Vue 3 即將成為默認，Vite 已是標配"
date: 2022-01-01 09:31:57
tags:
  - Vue
readingTime: 2
description: "新年伊始，前端生態正在完成一次安靜但重要的切換。Vue 3 預計在 2022 年第一季度成為 `npm install vue` 的默認版本，Vite 2 已經是大多數新項目的構建工具首選，React 18 正式版也近在眼前。這篇文章梳理 2021 年底前端格局，展望 2022 年的關鍵節點。"
wordCount: 455
---

新年伊始，前端生態正在完成一次安靜但重要的切換。Vue 3 預計在 2022 年第一季度成為 `npm install vue` 的默認版本，Vite 2 已經是大多數新項目的構建工具首選，React 18 正式版也近在眼前。這篇文章梳理 2021 年底前端格局，展望 2022 年的關鍵節點。

## Vue 3 生態補完情況

截至 2022 年初，Vue 3 生態缺口基本補齊：

```bash
# Vue 3 推薦技術棧（2022 年初）
vue@3.2          # Composition API + <script setup> 穩定
pinia@2          # 官方推薦狀態管理（替代 Vuex）
vue-router@4     # 支持 Composition API 路由
vite@2           # 官方推薦構建工具
vitest@0.x       # Vite 驅動的測試框架（早期）
```

`<script setup>` 已在 Vue 3.2 正式穩定，不再是實驗性語法：

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
    <button @click="logout">退出登錄</button>
  </div>
</template>
```

## Pinia 取代 Vuex 的時機

Vuex 5（專為 Vue 3 設計）開發陷入停滯，官方轉而推薦 Pinia：

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

對比 Vuex 4，Pinia 的優勢：

- 無 mutations，直接修改 state
- TypeScript 類型推斷開箱即用
- DevTools 支持完善
- Bundle 體積約 1.5KB（vs Vuex ~10KB）

## Vite 2 已成熟到生產可用

2021 年的實踐驗證了 Vite 2 可以用於生產大型項目：

```javascript
// vite.config.ts（2022 年常見配置）
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

React 18 從 2021 年 6 月發佈 Alpha，已歷經半年打磨。2022 年正式版將帶來：

- 自動批處理（Automatic Batching）
- `useTransition` 和 `useDeferredValue`
- Streaming SSR（`renderToPipeableStream`）
- `<Suspense>` 支持異步數據（非僅懶加載組件）

## 2022 值得關注的方向

| 方向       | 代表技術                      | 預判                |
| 
---------- | ----------------------------- | ------------------- |
| 構建工具   | Vite 3、Turbopack（Vercel）   | Vite 持續成為首選   |
| 全棧框架   | Next.js 13、Nuxt 3、SvelteKit | 元框架競爭加劇      |
| 狀態管理   | Pinia、Zustand、Jotai         | 輕量化、原子化趨勢  |
| 測試       | Vitest、Playwright            | Vitest 快速擴大份額 |
| TypeScript | TS 4.6、4.7、4.8              | 每版本都有實用改進  |

## 總結

2022 年的前端"戰場"已經清晰：Vue 3 完成新老交替，React 18 併發渲染落地，Vite 生態持續擴張。對開發者來説，現在是遷移到 Vue 3 + Pinia + Vite 組合的最佳時機，而 React 項目則值得儘早體驗 18 的併發特性。