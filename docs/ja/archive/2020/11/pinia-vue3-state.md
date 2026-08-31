---
title: "Pinia：Vue 3の新しい状態管理ソリューション"
date: 2020-11-15 17:14:15
tags:
  - Vue
readingTime: 2
description: "发布于 2020-11-15"
wordCount: 401
---

2020-11-15 に公開

> 注：Pinia は 2020 年時点では開発の初期段階にあり、2021 年に Vue の公式状態管理ソリューションとなった。本記事は初期バージョンに基づいて書かれている。

---

Pinia（尤雨渓が推奨する Vuex の代替）をしばらく使ってみたが、Vuex よりずっとシンプルだと感じる。

## なぜVuex 4を使わないのか

Vuex 4 は Vue 3 をサポートしているものの、API はほとんど変わらず、相変わらず mutations/actions の構成だ。問題点は次のとおり：

1. mutations と actions の役割が重複している（非同期はどちらも actions を使うのに、なぜ mutations が必要なのか）
2. TypeScript のサポートが不十分（複雑な型宣言が必要）
3. 名前空間モジュール（namespaced modules）が煩雑すぎる

## Piniaの基本

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

## Setup Store（より柔軟な構文）

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

## Store間の参照

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

## Vuex 4との比較

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

## まとめ

- Pinia は mutations を廃し、actions 内で直接 state を変更するため、よりシンプルだ
- TypeScript に親和性があり、型が自動推論される
- ストア間の参照は他のストアを直接 use するだけで済み、rootGetters は不要だ
- Setup Store の記法は Composition API と完全に一致する
- 尤雨渓はすでに、Pinia が Vue の公式状態管理となり、Vuex 5 は実質的に Pinia になると表明している
