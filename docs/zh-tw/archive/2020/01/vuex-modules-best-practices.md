---
title: "Vuex 4 模組化最佳實踐"
date: 2020-01-17 17:32:42
tags:
  - Vue
readingTime: 2
description: "專案一旦超過中等規模，Vuex 的 `store` 就會變得臃腫。Vuex 4 延續了模組化方案，但對 Composition API 做了適配。本文整理了我在多箇中大型 Vue 專案中驗證過的模組化實踐。"
wordCount: 313
---

專案一旦超過中等規模，Vuex 的 `store` 就會變得臃腫。Vuex 4 延續了模組化方案，但對 Composition API 做了適配。本文整理了我在多箇中大型 Vue 專案中驗證過的模組化實踐。

## 目錄結構設計

模組化不只是功能拆分，目錄結構決定了可維護性。推薦按業務域組織：

```
store/
├── index.js          # 入口，註冊所有模組
├── types.js          # 集中管理 mutation/action 常量
├── modules/
│   ├── auth.js       # 認證模組
│   ├── user.js       # 使用者模組
│   └── order.js      # 訂單模組
└── getters.js        # 跨模組的 getter
```

```javascript
// store/types.js
export const AUTH_LOGIN = 'AUTH_LOGIN'
export const AUTH_LOGOUT = 'AUTH_LOGOUT'
export const USER_SET_PROFILE = 'USER_SET_PROFILE'
export const ORDER_FETCH_LIST = 'ORDER_FETCH_LIST'
```

## 模組定義與名稱空間

每個模組使用獨立名稱空間，避免狀態和方法名衝突。

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

## 在元件中使用

名稱空間模組的呼叫需要帶路徑字首。

```vue
{% raw %}
<template>
  <div v-if="isAuthenticated">
    <p>歡迎，{{ username }}</p>
    <button @click="logout">退出登入</button>
  </div>
  <div v-else>
    <button @click="login({ username: 'admin', password: '123456' })">
      登入
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
      username: state => state.token ? state.user?.name : '未登入'
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

## 跨模組通訊

模組之間需要互動時，通過 `rootState` 和 `rootGetters` 訪問全域性狀態，或使用 `dispatch` 觸發其他模組的 action。

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
      // 讀取其他模組的狀態
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

關鍵細節：`dispatch` 第三個引數 `{ root: true }` 允許在名稱空間模組中觸發根級別的或其他模組的 action。

## 小結

- 使用 `namespaced: true` 隔離模組狀態，避免命名衝突
- 用常量檔案統一管理 mutation 和 action 名稱，IDE 友好且可搜尋
- 跨模組通訊通過 `rootState` 讀取狀態，`dispatch` 帶 `{ root: true }` 呼叫其他模組
- `createNamespacedHelpers` 簡化元件中對名稱空間模組的對映
