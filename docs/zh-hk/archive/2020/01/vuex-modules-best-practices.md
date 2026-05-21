---
title: "Vuex 4 模塊化最佳實踐"
date: 2020-01-17 17:32:42
tags:
  - Vue
readingTime: 2
description: "項目一旦超過中等規模，Vuex 的 `store` 就會變得臃腫。Vuex 4 延續了模塊化方案，但對 Composition API 做了適配。本文整理了我在多箇中大型 Vue 項目中驗證過的模塊化實踐。"
wordCount: 312
---

項目一旦超過中等規模，Vuex 的 `store` 就會變得臃腫。Vuex 4 延續了模塊化方案，但對 Composition API 做了適配。本文整理了我在多箇中大型 Vue 項目中驗證過的模塊化實踐。

## 目錄結構設計

模塊化不只是功能拆分，目錄結構決定了可維護性。推薦按業務域組織：

```
store/
├── index.js          # 入口，註冊所有模塊
├── types.js          # 集中管理 mutation/action 常量
├── modules/
│   ├── auth.js       # 認證模塊
│   ├── user.js       # 用户模塊
│   └── order.js      # 訂單模塊
└── getters.js        # 跨模塊的 getter
```

```javascript
// store/types.js
export const AUTH_LOGIN = 'AUTH_LOGIN'
export const AUTH_LOGOUT = 'AUTH_LOGOUT'
export const USER_SET_PROFILE = 'USER_SET_PROFILE'
export const ORDER_FETCH_LIST = 'ORDER_FETCH_LIST'
```

## 模塊定義與命名空間

每個模塊使用獨立命名空間，避免狀態和方法名衝突。

```javascript
// store/modules/auth.js
import { AUTH_LOGIN, AUTH_LOGOUT } from '../types'

export default {
  namespaced: true,

  state: () => ({
    token: localStorage.getItem('token') || '',
    loginTime: null
  }),

  getters: {
    isAuthenticated: state => !!state.token,
    tokenExpiry: state => {
      if (!state.loginTime) return false
      return Date.now() - state.loginTime < 7 * 24 * 60 * 60 * 1000
    }
  },

  mutations: {
    [AUTH_LOGIN](state, { token }) {
      state.token = token
      state.loginTime = Date.now()
      localStorage.setItem('token', token)
    },
    [AUTH_LOGOUT](state) {
      state.token = ''
      state.loginTime = null
      localStorage.removeItem('token')
    }
  },

  actions: {
    async [AUTH_LOGIN]({ commit }, credentials) {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })
      const data = await res.json()
      commit(AUTH_LOGIN, data)
      return data
    },

    async [AUTH_LOGOUT]({ commit }) {
      await fetch('/api/logout', { method: 'POST' })
      commit(AUTH_LOGOUT)
    }
  }
}
```

```javascript
// store/index.js
import { createStore } from 'vuex'
import auth from './modules/auth'
import user from './modules/user'
import order from './modules/order'

export default createStore({
  modules: {
    auth,
    user,
    order
  }
})
```

## 在組件中使用

命名空間模塊的調用需要帶路徑前綴。

```vue
{% raw %}
<template>
  <div v-if="isAuthenticated">
    <p>歡迎，{{ username }}</p>
    <button @click="logout">退出登錄</button>
  </div>
  <div v-else>
    <button @click="login({ username: 'admin', password: '123456' })">
      登錄
    </button>
  </div>
</template>

<script>
import { createNamespacedHelpers } from 'vuex'

const { mapState, mapGetters, mapActions } = createNamespacedHelpers('auth')

export default {
  computed: {
    ...mapGetters(['isAuthenticated']),
    ...mapState({
      username: state => state.token ? state.user?.name : '未登錄'
    })
  },
  methods: {
    ...mapActions(['AUTH_LOGIN', 'AUTH_LOGOUT']),
    login(credentials) {
      this.AUTH_LOGIN(credentials)
    },
    logout() {
      this.AUTH_LOGOUT()
    }
  }
}
</script>
{% endraw %}
```

## 跨模塊通信

模塊之間需要交互時，通過 `rootState` 和 `rootGetters` 訪問全局狀態，或使用 `dispatch` 觸發其他模塊的 action。

```javascript
// store/modules/order.js
import { ORDER_FETCH_LIST } from '../types'

export default {
  namespaced: true,

  state: () => ({
    list: [],
    loading: false
  }),

  actions: {
    async [ORDER_FETCH_LIST]({ commit, rootState, dispatch }) {
      // 讀取其他模塊的狀態
      const token = rootState.auth.token
      if (!token) {
        await dispatch('auth/AUTH_LOGIN', null, { root: true })
        return
      }

      commit('setLoading', true)
      const res = await fetch('/api/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      commit('setList', data)
      commit('setLoading', false)
    }
  },

  mutations: {
    setList(state, list) {
      state.list = list
    },
    setLoading(state, loading) {
      state.loading = loading
    }
  }
}
```

關鍵細節：`dispatch` 第三個參數 `{ root: true }` 允許在命名空間模塊中觸發根級別的或其他模塊的 action。

## 小結

- 使用 `namespaced: true` 隔離模塊狀態，避免命名衝突
- 用常量文件統一管理 mutation 和 action 名稱，IDE 友好且可搜索
- 跨模塊通信通過 `rootState` 讀取狀態，`dispatch` 帶 `{ root: true }` 調用其他模塊
- `createNamespacedHelpers` 簡化組件中對命名空間模塊的映射
