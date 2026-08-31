---
title: "2022年フロントエンド：Vue 3 がデフォルトに、Vite が標準へ"
date: 2022-01-01 09:31:57
tags:
  - Vue
readingTime: 3
description: "新年の始まりとともに、フロントエンドエコシステムは静かながら重要な切り替えを完了しつつあります。Vue 3 は2022年第1四半期に `npm install vue` のデフォルトバージョンになる見込みで、Vite 2 はすでに多くの新プロジェクトで優先されるビルドツールとなっており、React 18 の正式リリース"
wordCount: 753
---

新年の始まりとともに、フロントエンドエコシステムは静かながら重要な切り替えを完了しつつあります。Vue 3 は2022年第1四半期に `npm install vue` のデフォルトバージョンになる見込みで、Vite 2 はすでに多くの新プロジェクトで優先されるビルドツールとなっており、React 18 の正式リリースも目前に迫っています。この記事では2021年末のフロントエンドの状況を整理し、2022年の主要なマイルストーンを展望します。

## Vue 3 エコシステムの補完状況

2022 年初頭の時点で、Vue 3 のエコシステムのギャップはほぼ埋まっている：

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

Vuex 4 と比較した Pinia の利点：

- mutations がなく、state を直接変更できる
- TypeScript の型推論がそのまま使える
- DevTools のサポートが充実している
- バンドルサイズは約 1.5KB（Vuex は約 10KB）

## Vite 2 は本番環境で使える水準に成熟

2021 年の実践により、Vite 2 が大規模な本番プロジェクトに使えることが検証された：

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

## React 18 正式版が目前に

React 18 は 2021 年 6 月に Alpha がリリースされてから半年の研磨を経た。2022 年の正式版では以下がもたらされる：

- 自動バッチ処理（Automatic Batching）
- `useTransition` と `useDeferredValue`
- Streaming SSR（`renderToPipeableStream`）
- `<Suspense>` が非同期データをサポート（遅延コンポーネントだけでなく）

## 2022 年に注目すべき方向

| 方向       | 代表的な技術                    | 見通し              |
| ---------- | ----------------------------- | ------------------- |
| ビルドツール   | Vite 3、Turbopack（Vercel）   | Vite が引き続き首選に   |
| フルスタックフレームワーク   | Next.js 13、Nuxt 3、SvelteKit | メタフレームワーク競争が激化      |
| 状態管理   | Pinia、Zustand、Jotai         | 軽量・アトミックな方向へ  |
| テスト       | Vitest、Playwright            | Vitest がシェアを急速に拡大 |
| TypeScript | TS 4.6、4.7、4.8              | 各バージョンで実用的な改善  |

## まとめ

2022 年のフロントエンドの「戦場」は明確だ：Vue 3 が新旧の交代を完了し、React 18 の並行レンダリングが実用化され、Vite エコシステムが拡大を続ける。開発者にとって、今は Vue 3 + Pinia + Vite の組み合わせへ移行する最適な時期であり、React プロジェクトでも 18 の並行特性を早めに体験する価値がある。