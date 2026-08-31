---
title: "Vuex 4 in Vue 3 Projects: Practical Guide"
date: 2021-04-26 14:31:03
tags:
  - Vue

readingTime: 2
description: "After Vue 3's official release, Vuex 4 as its companion state-management solution also entered a stable phase. While migrating a mid-sized admin system from Vue 2 + Vuex 3 to Vue 3 + Vuex 4, I collected practical lessons and caveats worth sharing."
wordCount: 194
---

After Vue 3's official release, Vuex 4—its companion state-management solution—also reached a stable stage. While migrating a medium-sized admin system from Vue 2 + Vuex 3 to Vue 3 + Vuex 4, we summarized some practical lessons and gotchas.

## Installation and Initialization Changes

The biggest change in Vuex 4 is that initialization moved from `new Vuex.Store()` to `createStore()`, along with how the store is mounted:

```javascript
// store/index.ts
import { createStore } from 'vuex'
import user from './modules/user'
import order from './modules/order'

export default createStore({
  modules: {
    user,
    order
  },
  strict: process.env.NODE_ENV !== 'production'
})

// main.ts
import { createApp } from 'vue'
import store from './store'
import App from './App.vue'

const app = createApp(App)
app.use(store) // 通过 use 挂载
app.mount('#app')
```

## Accessing Store with Composition API

Accessing the store inside `setup` differs from the Options API:

```vue
<script setup lang="ts">
import { useStore } from 'vuex'
import { computed } from 'vue'

const store = useStore()

// 读取 state
const count = computed(() => store.state.count)

// 读取 getter
const doubleCount = computed(() => store.getters.doubleCount)

// 提交 mutation
const increment = () => store.commit('increment')

// 分发 action
const fetchData = async () => {
  await store.dispatch('user/fetchProfile')
}

// 访问命名空间模块
const userName = computed(() => store.state.user.profile.name)
</script>
```

## Modular Design

Admin systems are usually split into modules by business domain:

```typescript
// store/modules/user.ts
import { Module } from 'vuex'
import { RootState, UserState } from '../types'

const userModule: Module<UserState, RootState> = {
  namespaced: true,

  state: () => ({
    profile: null,
    permissions: [],
    token: localStorage.getItem('token') || ''
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    hasPermission: (state) => (perm: string) => {
      return state.permissions.includes(perm)
    }
  },

  mutations: {
    SET_PROFILE(state, profile) {
      state.profile = profile
    },
    SET_TOKEN(state, token) {
      state.token = token
      localStorage.setItem('token', token)
    }
  },

  actions: {
    async login({ commit }, credentials) {
      const { token, profile } = await api.login(credentials)
      commit('SET_TOKEN', token)
      commit('SET_PROFILE', profile)
    },
    async fetchProfile({ commit, state }) {
      if (!state.token) return
      const profile = await api.getProfile()
      commit('SET_PROFILE', profile)
    }
  }
}

export default userModule
```

## Type Definitions

Vuex's TypeScript support has never been great, so it's best to define the types manually:

```typescript
// store/types.ts
export interface UserProfile {
  id: number
  name: string
  role: 'admin' | 'user'
}

export interface UserState {
  profile: UserProfile | null
  permissions: string[]
  token: string
}

export interface RootState {
  // 全局 state
  appVersion: string
}

// 增强 useStore 的类型
import { Store, useStore as baseUseStore } from 'vuex'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $store: Store<RootState>
  }
}

export function useStore() {
  return baseUseStore<RootState>()
}
```

## Comparison with Pinia

To be honest, Pinia offers a better developer experience. For a Vue 3 project without existing baggage, we'd suggest going straight to Pinia:

```
Vuex 4 的优势：
- 生态更成熟，社区资源更多
- 从 Vuex 3 迁移成本低
- Vue DevTools 支持完善

Pinia 的优势：
- 完整的 TypeScript 支持
- 去掉 mutation，只有 state + actions
- 更简洁的 API
- 组合式风格，更 Vue 3
```

## Summary

- Vuex 4's API changes little; the main shifts are the initialization approach and the introduction of `useStore()`.
- In the Composition API, use `useStore()` instead of `this.$store`.
- TypeScript types need to be defined manually—a weak spot of Vuex.
- For a brand-new project with no legacy constraints, consider evaluating Pinia.
- Modular design and namespacing are essential practices for large projects.