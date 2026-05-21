---
title: "Pinia：Vue 3 的下一代狀態管理"
date: 2021-07-05 10:05:15
tags:
  - Vue
  - Pinia
  - TypeScript
readingTime: 2
description: "Vuex 4 能用，但寫起來總覺得彆扭。Pinia 是 Vue 核心團隊成員開發的新狀態管理庫，API 設計比 Vuex 乾淨很多，已經在 Vue 3 專案裡用了兩個多月，分享一下經驗。"
wordCount: 324
---

Vuex 4 能用，但寫起來總覺得彆扭。Pinia 是 Vue 核心團隊成員開發的新狀態管理庫，API 設計比 Vuex 乾淨很多，已經在 Vue 3 專案裡用了兩個多月，分享一下經驗。

## 為什麼不用 Vuex 4

Vuex 4 能在 Vue 3 裡跑，但核心問題沒解決：

- TypeScript 支援差（要靠一堆型別體操）
- mutations 和 actions 分開寫，大部分時候 mutation 就是賦值
- 模組系統複雜（namespace、modules 巢狀）

Pinia 直接砍掉了 mutations，actions 統一處理同步和非同步操作。

## 基本用法

```bash
npm install pinia
```

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

```typescript
// stores/user.ts
import { defineStore } from 'pinia'

interface UserState {
  name: string
  token: string | null
  permissions: string[]
}

export const useUserStore = defineStore('user', {
  // state 用函式返回（和 Vue 3 元件的 data 一樣）
  state: (): UserState => ({
    name: '',
    token: null,
    permissions: [],
  }),

  getters: {
    // 自動推斷返回型別，不用手動宣告
    isAdmin: (state) => state.permissions.includes('admin'),

    // getter 可以依賴其他 getter
    greeting: (state) => `歡迎回來，${state.name}`,
  },

  actions: {
    // 不需要 mutation，直接改 state
    async login(username: string, password: string) {
      const res = await api.login(username, password)
      this.token = res.token
      this.name = res.name
      this.permissions = res.permissions
    },

    logout() {
      this.$reset() // 重置到初始狀態
    },
  },
})
```

## 在元件中使用

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()

// 解構會丟失響應性，用 storeToRefs
const { name, isAdmin } = storeToRefs(userStore)

// actions 直接解構就行（是普通函式）
const { login, logout } = userStore

// 直接訪問 state
console.log(userStore.token)

// 直接修改 state（開發工具能追蹤到）
userStore.name = '張三'
</script>
```

## 對比 Vuex

```typescript
// Vuex：要寫 mutation
const store = createStore({
  state: { count: 0 },
  mutations: {
    SET_COUNT(state, value) {
      state.count = value
    },
  },
  actions: {
    async fetchCount({ commit }) {
      const res = await api.getCount()
      commit('SET_COUNT', res.count) // 必須通過 mutation
    },
  },
})

// Pinia：直接改
export const useCountStore = defineStore('count', {
  state: () => ({ count: 0 }),
  actions: {
    async fetchCount() {
      const res = await api.getCount()
      this.count = res.count // 直接賦值
    },
  },
})
```

## Store 組合（替代 Vuex modules）

```typescript
// stores/cart.ts
import { defineStore } from 'pinia'
import { useUserStore } from './user'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
  }),

  actions: {
    async checkout() {
      // 直接呼叫其他 store
      const userStore = useUserStore()
      if (!userStore.token) {
        throw new Error('請先登入')
      }
      await api.checkout(this.items, userStore.token)
      this.items = []
    },
  },
})
```

不需要 namespaced，不需要 rootGetters，直接 import 就能用。

## 開發工具整合

Pinia 自帶 DevTools 支援，Vue DevTools 裡能看到：

- 每個 store 的 state 變化
- 時間旅行除錯
- 修改 state 後即時更新

## 和 Tailwind CSS JIT 配合的小技巧

Pinia 管狀態，Tailwind 管樣式，配合很自然：

```vue
<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <div :class="themeStore.isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'">
    <slot />
  </div>
</template>
```

## 小結

- Pinia 是 Vue 3 狀態管理的未來，Vuex 5 會基於 Pinia 的設計
- 砍掉 mutations，TypeScript 原生支援，API 更簡潔
- Store 之間直接 import 呼叫，不需要 Vuex modules 的巢狀
- 適合新專案直接用；老專案遷移成本不大（狀態邏輯可以逐步遷移）