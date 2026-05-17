---
title: "Vuex 4 を Vue 3 プロジェクトで活用する"
date: 2021-04-26 14:31:03
tags:
  - Vue

readingTime: 2
description: "Vue 3 正式发布后，Vuex 4 作为其配套状态管理方案也进入了稳定期。在将一个中型后台管理系统从 Vue 2 + Vuex 3 迁移到 Vue 3 + Vuex 4 的过程中，总结了一些实践经验和注意事项。"
---

Vue 3 正式发布后，Vuex 4 作为其配套状态管理方案也进入了稳定期。在将一个中型后台管理系统从 Vue 2 + Vuex 3 迁移到 Vue 3 + Vuex 4 的过程中，总结了一些实践经验和注意事项。

## インストールと初期化の変更

Vuex 4 最大的变化是初始化方式从 `new Vuex.Store()` 变为 `createStore()`，以及挂载方式的变化：

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

## Composition API でのStore アクセス

在 setup 中访问 store 的方式和 Options API 不同：

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

## モジュール設計

后台管理系统通常按业务域拆分模块：

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

## 型定義

Vuex 对 TypeScript 的支持一直不太好，建议手动定义类型：

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

## Pinia との比較

坦白说，Pinia 的开发体验更好。在 Vue 3 项目中如果还没有技术包袱，建议直接用 Pinia：

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

## まとめ

- Vuex 4 的 API 变化不大，主要是初始化方式和 `useStore()` 的引入
- 在 Composition API 中用 `useStore()` 代替 `this.$store`
- TypeScript 类型需要手动定义，这是 Vuex 的短板
- 如果是全新项目且没有历史包袱，建议评估 Pinia
- 模块化设计和命名空间是大型项目的必备实践