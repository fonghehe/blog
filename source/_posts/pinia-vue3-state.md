---
title: "Pinia：Vue 3 的新状态管理方案"
date: 2020-11-15 17:14:15
tags:
  - Vue
---

发布于 2020-11-15

> 注：Pinia 在 2020 年处于早期开发阶段，2021 年成为 Vue 官方状态管理方案。本文基于早期版本撰写。

---

用了一段时间 Pinia（尤雨溪推荐的 Vuex 替代品），感觉比 Vuex 简单多了。

## 为什么不用 Vuex 4

Vuex 4 虽然支持 Vue 3，但 API 几乎没变，还是 mutations/actions 那套。问题：

1. mutations 和 actions 功能重叠（异步都用 actions，为啥还要 mutations？）
2. 对 TypeScript 支持不好（需要复杂的类型声明）
3. 命名空间模块（namespaced modules）太繁琐

## Pinia 基础

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

## Setup Store（更灵活的语法）

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

## Store 间引用

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

## 对比 Vuex 4

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

## 小结

- Pinia 去掉了 mutations，直接在 actions 里改 state，更简单
- 对 TypeScript 友好，类型自动推导
- Store 间引用直接 use 对方的 store，不需要 rootGetters
- Setup Store 语法和 Composition API 完全一致
- 尤雨溪已经表示 Pinia 将成为 Vue 的官方状态管理，Vuex 5 直接就是 Pinia
