---
title: "Pinia：Vue 3 的下一代状态管理"
date: 2021-07-05 10:05:15
tags:
  - Vue
  - Pinia
  - TypeScript
readingTime: 2
description: "Vuex 4 能用，但写起来总觉得别扭。Pinia 是 Vue 核心团队成员开发的新状态管理库，API 设计比 Vuex 干净很多，已经在 Vue 3 项目里用了两个多月，分享一下经验。"
wordCount: 323
---

Vuex 4 能用，但写起来总觉得别扭。Pinia 是 Vue 核心团队成员开发的新状态管理库，API 设计比 Vuex 干净很多，已经在 Vue 3 项目里用了两个多月，分享一下经验。

## 为什么不用 Vuex 4

Vuex 4 能在 Vue 3 里跑，但核心问题没解决：

- TypeScript 支持差（要靠一堆类型体操）
- mutations 和 actions 分开写，大部分时候 mutation 就是赋值
- 模块系统复杂（namespace、modules 嵌套）

Pinia 直接砍掉了 mutations，actions 统一处理同步和异步操作。

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

## 在组件中使用

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

## 对比 Vuex

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

## Store 组合（替代 Vuex modules）

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

不需要 namespaced，不需要 rootGetters，直接 import 就能用。

## 开发工具集成

Pinia 自带 DevTools 支持，Vue DevTools 里能看到：

- 每个 store 的 state 变化
- 时间旅行调试
- 修改 state 后实时更新

## 和 Tailwind CSS JIT 配合的小技巧

Pinia 管状态，Tailwind 管样式，配合很自然：

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

## 小结

- Pinia 是 Vue 3 状态管理的未来，Vuex 5 会基于 Pinia 的设计
- 砍掉 mutations，TypeScript 原生支持，API 更简洁
- Store 之间直接 import 调用，不需要 Vuex modules 的嵌套
- 适合新项目直接用；老项目迁移成本不大（状态逻辑可以逐步迁移）