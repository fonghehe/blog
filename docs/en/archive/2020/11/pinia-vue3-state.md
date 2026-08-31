---
title: "Pinia: The New State Management Solution for Vue 3"
date: 2020-11-15 17:14:15
tags:
  - Vue
readingTime: 2
description: "An early look at Pinia as a new state management solution for Vue 3, published during its initial development stage before it became the official recommendation."
wordCount: 173
---

Published on 2020-11-15

> Note: Pinia was still in its early development stage in 2020 and became Vue's official state-management solution in 2021. This article is based on an early version.

---

I've been using Pinia (Evan You's recommended Vuex alternative) for a while, and it feels much simpler than Vuex.

## Why Not Vuex 4

Vuex 4 does support Vue 3, but its API is barely changed — still the same mutations/actions setup. The problems:

1. mutations and actions overlap in responsibility (async logic already goes in actions, so why keep mutations?)
2. poor TypeScript support (needs verbose type declarations)
3. namespaced modules are too cumbersome

## Pinia Basics

```bash
npm install pinia
```

```typescript
// stores/user.ts
import { defineStore } from "pinia";
import type { User } from "../types";

export const useUserStore = defineStore("user", {
  // 等价于 data
  state: (): { user: User | null; loading: boolean } => ({
    user: null,
    loading: false,
  }),

  // 等价于 computed
  getters: {
    isLoggedIn: (state) => state.user !== null,
    displayName: (state) => state.user?.name ?? "游客",
  },

  // 等价于 methods（合并了 mutations 和 actions）
  actions: {
    async login(credentials: { email: string; password: string }) {
      this.loading = true;
      try {
        const user = await api.login(credentials);
        this.user = user; // 直接修改 state！
        localStorage.setItem("token", user.token);
      } finally {
        this.loading = false;
      }
    },

    logout() {
      this.user = null;
      localStorage.removeItem("token");
    },
  },
});
```

```vue
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

// storeToRefs 保持响应性（直接解构会失去）
const { user, isLoggedIn, displayName } = storeToRefs(userStore);

// actions 可以直接解构（不是 ref，不需要 storeToRefs）
const { login, logout } = userStore;

async function handleLogin(credentials) {
  await login(credentials);
  router.push("/dashboard");
}
</script>
```

## Setup Store (More Flexible Syntax)

```typescript
// 类似 Vue 3 的 setup 风格
export const useCounterStore = defineStore("counter", () => {
  const count = ref(0);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  async function incrementAsync() {
    await delay(1000);
    count.value++;
  }

  return { count, doubled, increment, incrementAsync };
});
```

## Cross-Store References

```typescript
// stores/cart.ts
import { defineStore } from "pinia";
import { useUserStore } from "./user";

export const useCartStore = defineStore("cart", {
  state: () => ({ items: [] }),

  actions: {
    async addToCart(productId: number) {
      // 直接使用其他 store（比 Vuex 的 rootGetters 简洁多了）
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        throw new Error("请先登录");
      }
      await api.addToCart(userStore.user!.id, productId);
      // ...
    },
  },
});
```

## Comparison with Vuex 4

```typescript
// Vuex 4（TypeScript 支持麻烦）
const store = useStore();
store.commit("user/SET_USER", user); // 字符串类型不安全
store.dispatch("user/login", credentials); // 返回值类型不确定
const name = store.getters["user/displayName"] as string; // 需要手动断言

// Pinia（TypeScript 友好）
const userStore = useUserStore();
userStore.user = user; // 直接赋值，有类型检查
await userStore.login(credentials); // 返回类型自动推导
const name = userStore.displayName; // 类型正确
```

## Summary

- Pinia drops mutations and lets you mutate state directly inside actions — simpler.
- TypeScript-friendly, with automatically inferred types.
- Cross-store references just call the other store directly — no rootGetters needed.
- Setup Store syntax matches the Composition API exactly.
- Evan You has said Pinia will become Vue's official state management, and Vuex 5 is essentially Pinia.
