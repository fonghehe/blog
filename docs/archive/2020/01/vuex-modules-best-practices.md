---
title: "Vuex 4 模块化最佳实践"
date: 2020-01-17 17:32:42
tags:
  - Vue
readingTime: 2
description: "项目一旦超过中等规模，Vuex 的 `store` 就会变得臃肿。Vuex 4 延续了模块化方案，但对 Composition API 做了适配。本文整理了我在多个中大型 Vue 项目中验证过的模块化实践。"
wordCount: 312
---

项目一旦超过中等规模，Vuex 的 `store` 就会变得臃肿。Vuex 4 延续了模块化方案，但对 Composition API 做了适配。本文整理了我在多个中大型 Vue 项目中验证过的模块化实践。

## 目录结构设计

模块化不只是功能拆分，目录结构决定了可维护性。推荐按业务域组织：

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

## 模块定义与命名空间

每个模块使用独立命名空间，避免状态和方法名冲突。

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

## 在组件中使用

命名空间模块的调用需要带路径前缀。

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

## 跨模块通信

模块之间需要交互时，通过 `rootState` 和 `rootGetters` 访问全局状态，或使用 `dispatch` 触发其他模块的 action。

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

关键细节：`dispatch` 第三个参数 `{ root: true }` 允许在命名空间模块中触发根级别的或其他模块的 action。

## 小结

- 使用 `namespaced: true` 隔离模块状态，避免命名冲突
- 用常量文件统一管理 mutation 和 action 名称，IDE 友好且可搜索
- 跨模块通信通过 `rootState` 读取状态，`dispatch` 带 `{ root: true }` 调用其他模块
- `createNamespacedHelpers` 简化组件中对命名空间模块的映射
