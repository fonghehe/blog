---
title: "Pinia: The Next-Generation State Management for Vue 3"
date: 2021-07-05 10:05:15
tags:
  - Vue
  - TypeScript

readingTime: 2
description: "Vuex 4 works, but writing with it always feels awkward. Pinia is a new state-management library built by a Vue core team member, with an API that's much cleaner than Vuex's. I've been using it in a Vue 3 project for over two months now, so here's my experience."
wordCount: 251
---

Vuex 4 works, but writing with it always feels awkward. Pinia is a new state-management library built by a Vue core team member, with an API that's much cleaner than Vuex's. I've been using it in a Vue 3 project for over two months now, so here's my experience.

## Why Not Use Vuex 4

Vuex 4 runs in Vue 3, but its core problems were never solved:

- Poor TypeScript support (you need a lot of type gymnastics)
- Mutations and actions are split apart, yet most of the time a mutation just assigns a value
- The module system is complex (namespacing, nested modules)

Pinia simply drops mutations; actions handle both synchronous and asynchronous operations.

## Basic Usage

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
  // state 用函数返回（和 Vue 3 组件的 data 一样）
  state: (): UserState => ({
    name: '',
    token: null,
    permissions: [],
  }),

  getters: {
    // 自动推断返回类型，不用手动声明
    isAdmin: (state) => state.permissions.includes('admin'),

    // getter 可以依赖其他 getter
    greeting: (state) => `欢迎回来，${state.name}`,
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
      this.$reset() // 重置到初始状态
    },
  },
})
```

## Using in Components

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()

// 解构会丢失响应性，用 storeToRefs
const { name, isAdmin } = storeToRefs(userStore)

// actions 直接解构就行（是普通函数）
const { login, logout } = userStore

// 直接访问 state
console.log(userStore.token)

// 直接修改 state（开发工具能追踪到）
userStore.name = '张三'
</script>
```

## Comparison with Vuex

```typescript
// Vuex：要写 mutation
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
      commit('SET_COUNT', res.count) // 必须通过 mutation
    },
  },
})

// Pinia：直接改
export const useCountStore = defineStore('count', {
  state: () => ({ count: 0 }),
  actions: {
    async fetchCount() {
      const res = await api.getCount()
      this.count = res.count // 直接赋值
    },
  },
})
```

## Store Composition (a Replacement for Vuex Modules)

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
      // 直接调用其他 store
      const userStore = useUserStore()
      if (!userStore.token) {
        throw new Error('请先登录')
      }
      await api.checkout(this.items, userStore.token)
      this.items = []
    },
  },
})
```

No namespacing, no rootGetters — you just import a store and use it.

## Dev Tools Integration

Pinia ships with built-in DevTools support. In Vue DevTools you can see:

- State changes for each store
- Time-travel debugging
- Live updates after modifying state

## Tips for Working with Tailwind CSS JIT

Pinia manages state while Tailwind handles styling, and they pair together naturally:

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

## Summary

- Pinia is the future of state management for Vue 3, and Vuex 5 will be based on Pinia's design
- It drops mutations, supports TypeScript natively, and offers a cleaner API
- Stores call each other through direct imports, with no nested Vuex modules
- Great for new projects right away; the migration cost for existing projects is low (you can move state logic over gradually)