---
title: "Pinia：Vue 3 的新狀態管理方案"
date: 2020-11-15 17:14:15
tags:
  - Vue
readingTime: 2
description: "釋出於 2020-11-15"
---

釋出於 2020-11-15

> 注：Pinia 在 2020 年處於早期開發階段，2021 年成為 Vue 官方狀態管理方案。本文基於早期版本撰寫。

---

用了一段時間 Pinia（尤雨溪推薦的 Vuex 替代品），感覺比 Vuex 簡單多了。

## 為什麼不用 Vuex 4

Vuex 4 雖然支援 Vue 3，但 API 幾乎沒變，還是 mutations/actions 那套。問題：

1. mutations 和 actions 功能重疊（非同步都用 actions，為啥還要 mutations？）
2. 對 TypeScript 支援不好（需要複雜的型別宣告）
3. 名稱空間模組（namespaced modules）太繁瑣

## Pinia 基礎

```bash
npm install pinia
```

```typescript
// stores/user.ts
import { defineStore } from "pinia";
import type { User } from "../types";

export const useUserStore = defineStore("user", {
  // 等價於 data
  state: (): { user: User | null; loading: boolean } => ({
    user: null,
    loading: false,
  }),

  // 等價於 computed
  getters: {
    isLoggedIn: (state) => state.user !== null,
    displayName: (state) => state.user?.name ?? "遊客",
  },

  // 等價於 methods（合併了 mutations 和 actions）
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

// storeToRefs 保持響應性（直接解構會失去）
const { user, isLoggedIn, displayName } = storeToRefs(userStore);

// actions 可以直接解構（不是 ref，不需要 storeToRefs）
const { login, logout } = userStore;

async function handleLogin(credentials) {
  await login(credentials);
  router.push("/dashboard");
}
</script>
```

## Setup Store（更靈活的語法）

```typescript
// 類似 Vue 3 的 setup 風格
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

## Store 間引用

```typescript
// stores/cart.ts
import { defineStore } from "pinia";
import { useUserStore } from "./user";

export const useCartStore = defineStore("cart", {
  state: () => ({ items: [] }),

  actions: {
    async addToCart(productId: number) {
      // 直接使用其他 store（比 Vuex 的 rootGetters 簡潔多了）
      const userStore = useUserStore();
      if (!userStore.isLoggedIn) {
        throw new Error("請先登入");
      }
      await api.addToCart(userStore.user!.id, productId);
      // ...
    },
  },
});
```

## 對比 Vuex 4

```typescript
// Vuex 4（TypeScript 支援麻煩）
const store = useStore();
store.commit("user/SET_USER", user); // 字串型別不安全
store.dispatch("user/login", credentials); // 返回值型別不確定
const name = store.getters["user/displayName"] as string; // 需要手動斷言

// Pinia（TypeScript 友好）
const userStore = useUserStore();
userStore.user = user; // 直接賦值，有型別檢查
await userStore.login(credentials); // 返回型別自動推導
const name = userStore.displayName; // 型別正確
```

## 小結

- Pinia 去掉了 mutations，直接在 actions 裡改 state，更簡單
- 對 TypeScript 友好，型別自動推導
- Store 間引用直接 use 對方的 store，不需要 rootGetters
- Setup Store 語法和 Composition API 完全一致
- 尤雨溪已經表示 Pinia 將成為 Vue 的官方狀態管理，Vuex 5 直接就是 Pinia
