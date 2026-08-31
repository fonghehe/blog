---
title: "Vuex 4 Modular Best Practices"
date: 2020-01-17 17:32:42
tags:
  - Vue
readingTime: 2
description: "Once a project grows beyond medium size, the Vuex store becomes bloated. Vuex 4 continues the modular approach but adapts it for the Composition API. This article collects modularization practices validated across several medium-to-large Vue projects."
wordCount: 181
---

Once a project grows beyond medium size, the Vuex `store` becomes bloated. Vuex 4 continues the modular approach but adapts it for the Composition API. This article collects the modularization practices I've validated across several medium-to-large Vue projects.

## Directory Structure Design

Modularization isn't just about splitting features—the directory structure determines maintainability. I recommend organizing by business domain:

```
store/
├── index.js          # 入口，注册所有模块
├── types.js          # 集中管理 mutation/action 常量
├── modules/
│   ├── auth.js       # 认证模块
│   ├── user.js       # 用户模块
│   └── order.js      # 订单模块
└── getters.js        # 跨模块的 getter
```

```javascript
// store/types.js
export const AUTH_LOGIN = 'AUTH_LOGIN'
export const AUTH_LOGOUT = 'AUTH_LOGOUT'
export const USER_SET_PROFILE = 'USER_SET_PROFILE'
export const ORDER_FETCH_LIST = 'ORDER_FETCH_LIST'
```

## Module Definition and Namespacing

Each module uses an independent namespace to avoid conflicts between state and method names.

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

## Using Modules in Components

Calls to namespaced modules need the path prefix.

```vue
{% raw %}
<template>
  <div v-if="isAuthenticated">
    <p>欢迎，{{ username }}</p>
    <button @click="logout">退出登录</button>
  </div>
  <div v-else>
    <button @click="login({ username: 'admin', password: '123456' })">
      登录
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
      username: state => state.token ? state.user?.name : '未登录'
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

## Cross-Module Communication

When modules need to interact, access global state via `rootState` and `rootGetters`, or use `dispatch` to trigger another module's action.

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
      // 读取其他模块的状态
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

Key detail: the third argument `{ root: true }` to `dispatch` lets a namespaced module trigger a root-level or another module's action.

## Summary

- Use `namespaced: true` to isolate module state and avoid naming conflicts.
- Manage mutation and action names in a constants file for IDE-friendliness and searchability.
- For cross-module communication, read state via `rootState` and call other modules with `dispatch` plus `{ root: true }`.
- `createNamespacedHelpers` simplifies mapping namespaced modules in components.
