---
title: "Vuex 4 を Vue 3 プロジェクトで活用する"
date: 2021-04-26 14:31:03
tags:
  - Vue

readingTime: 3
description: "Vue 3 正式发布后，Vuex 4 作为其配套状态管理方案也进入了稳定期。在将一个中型后台管理系统从 Vue 2 + Vuex 3 迁移到 Vue 3 + Vuex 4 的过程中，总结了一些实践经验和注意事项。"
wordCount: 468
---

Vue 3 が正式リリースされた後、それに伴う状態管理ソリューションとしての Vuex 4 も安定版の段階に入った。中規模の管理画面システムを Vue 2＋Vuex 3 から Vue 3＋Vuex 4 へ移行する過程で、いくつかの実践的な経験と注意点をまとめた。

## インストールと初期化の変更

Vuex 4 で最も大きく変わったのは、初期化方法が `new Vuex.Store()` から `createStore()` になったことと、マウント方法の変更だ：

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

setup 内で store にアクセスする方法は、Options API とは異なる：

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

管理画面システムでは通常、業務ドメインごとにモジュールを分割する：

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

Vuex の TypeScript サポートはこれまで芳しくないため、型は手動で定義するのがおすすめだ：

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

率直に言うと、Pinia の方が開発体験は優れている。Vue 3 プロジェクトでまだ既存の技術的負債がなければ、Pinia をそのまま使うのがおすすめだ：

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

- Vuex 4 の API 変更は大きくなく、主な違いは初期化方法と `useStore()` の導入だ
- Composition API では `this.$store` の代わりに `useStore()` を使う
- TypeScript の型は手動で定義する必要があり、これが Vuex の弱点だ
- 完全に新しいプロジェクトで過去の負債がなければ、Pinia の採用を検討するのがよい
- モジュール化設計と名前空間は、大規模プロジェクトでは必須の実践だ