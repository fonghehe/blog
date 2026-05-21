---
title: "2022年フロントエンド：Vue 3 がデフォルトに、Vite が標準へ"
date: 2022-01-01 09:31:57
tags:
  - Vue
readingTime: 3
description: "新年の始まりとともに、フロントエンドエコシステムは静かながら重要な切り替えを完了しつつあります。Vue 3 は2022年第1四半期に `npm install vue` のデフォルトバージョンになる見込みで、Vite 2 はすでに多くの新プロジェクトで優先されるビルドツールとなっており、React 18 の正式リリース"
wordCount: 570
---

新年の始まりとともに、フロントエンドエコシステムは静かながら重要な切り替えを完了しつつあります。Vue 3 は2022年第1四半期に `npm install vue` のデフォルトバージョンになる見込みで、Vite 2 はすでに多くの新プロジェクトで優先されるビルドツールとなっており、React 18 の正式リリースも目前に迫っています。この記事では2021年末のフロントエンドの状況を整理し、2022年の主要なマイルストーンを展望します。

## Vue 3 エコシステムの補完状況

截至 2022 年初，Vue 3 生态缺口基本补齐：

```bash
# Vue 3 推荐技术栈（2022 年初）
vue@3.2          # Composition API + <script setup> 稳定
pinia@2          # 官方推荐状态管理（替代 Vuex）
vue-router@4     # 支持 Composition API 路由
vite@2           # 官方推荐构建工具
vitest@0.x       # Vite 驱动的测试框架（早期）
```

`<script setup>` は Vue 3.2 で正式に安定化され、実験的な構文ではなくなりました：

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

## Pinia が Vuex を置き換えるタイミング

Vuex 5（Vue 3 専用に設計）の開発が停滞し、公式チームは Pinia を推奨するようになりました：

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
| ---------- | ----------------------------- | ------------------- |
| 构建工具   | Vite 3、Turbopack（Vercel）   | Vite 持续成为首选   |
| 全栈框架   | Next.js 13、Nuxt 3、SvelteKit | 元框架竞争加剧      |
| 状态管理   | Pinia、Zustand、Jotai         | 轻量化、原子化趋势  |
| 测试       | Vitest、Playwright            | Vitest 快速扩大份额 |
| TypeScript | TS 4.6、4.7、4.8              | 每版本都有实用改进  |

## まとめ

2022 年的前端"战场"已经清晰：Vue 3 完成新老交替，React 18 并发渲染落地，Vite 生态持续扩张。对开发者来说，现在是迁移到 Vue 3 + Pinia + Vite 组合的最佳时机，而 React 项目则值得尽早体验 18 的并发特性。