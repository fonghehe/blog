---
title: "Vuex 4 在 Vue 3 項目中的實踐：落地路徑與實戰建議"
date: 2021-04-26 14:31:03
tags:
  - Vue
readingTime: 2
description: "Vue 3 正式發佈後，Vuex 4 作為其配套狀態管理方案也進入了穩定期。在將一箇中型後臺管理系統從 Vue 2 + Vuex 3 遷移到 Vue 3 + Vuex 4 的過程中，總結了一些實踐經驗和注意事項。"
wordCount: 305
---

Vue 3 正式發佈後，Vuex 4 作為其配套狀態管理方案也進入了穩定期。在將一箇中型後臺管理系統從 Vue 2 + Vuex 3 遷移到 Vue 3 + Vuex 4 的過程中，總結了一些實踐經驗和注意事項。

## 安裝和初始化變化

Vuex 4 最大的變化是初始化方式從 `new Vuex.Store()` 變為 `createStore()`，以及掛載方式的變化：

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
app.use(store) // 通過 use 掛載
app.mount('#app')
```

## 使用 Composition API 訪問 Store

在 setup 中訪問 store 的方式和 Options API 不同：

```vue
<script setup lang="ts">
import { useStore } from 'vuex'
import { computed } from 'vue'

const store = useStore()

// 讀取 state
const count = computed(() => store.state.count)

// 讀取 getter
const doubleCount = computed(() => store.getters.doubleCount)

// 提交 mutation
const increment = () => store.commit('increment')

// 分發 action
const fetchData = async () => {
  await store.dispatch('user/fetchProfile')
}

// 訪問命名空間模塊
const userName = computed(() => store.state.user.profile.name)
</script>
```

## 模塊化設計

後臺管理系統通常按業務域拆分模塊：

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

## 類型定義

Vuex 對 TypeScript 的支持一直不太好，建議手動定義類型：

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

// 增強 useStore 的類型
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

## 和 Pinia 的對比

坦白説，Pinia 的開發體驗更好。在 Vue 3 項目中如果還沒有技術包袱，建議直接用 Pinia：

```
Vuex 4 的優勢：
- 生態更成熟，社區資源更多
- 從 Vuex 3 遷移成本低
- Vue DevTools 支持完善

Pinia 的優勢：
- 完整的 TypeScript 支持
- 去掉 mutation，隻有 state + actions
- 更簡潔的 API
- 組合式風格，更 Vue 3
```

## 小結

- Vuex 4 的 API 變化不大，主要是初始化方式和 `useStore()` 的引入
- 在 Composition API 中用 `useStore()` 代替 `this.$store`
- TypeScript 類型需要手動定義，這是 Vuex 的短板
- 如果是全新項目且沒有歷史包袱，建議評估 Pinia
- 模塊化設計和命名空間是大型項目的必備實踐