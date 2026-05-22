---
title: "Vuex 4 モジュール化のベストプラクティス"
date: 2020-01-17 17:32:42
tags:
  - Vue
readingTime: 3
description: "プロジェクトが中規模を超えると、Vuex の store が肥大化しがちです。Vuex 4 はモジュール化の手法を継承しつつ、Composition API に対応しています。この記事では、複数の中大規模 Vue プロジェクトで検証したモジュール化のプラクティスをまとめました。"
wordCount: 538
---

プロジェクトが中規模を超えると、Vuex の `store` が肥大化しがちです。Vuex 4 はモジュール化の手法を継承しつつ、Composition API に対応しています。この記事では、複数の中大規模 Vue プロジェクトで検証したモジュール化のプラクティスをまとめました。

## ディレクトリ構造の設計

モジュール化は単なる機能分割ではありません。ディレクトリ構造が保守性を左右します。業務ドメインごとに整理することをお勧めします：

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

## モジュール定義と名前空間

各モジュールは独立した名前空間を使用し、状態やメソッド名の競合を防ぎます。

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

## コンポーネントでの使用

名前空間モジュールの呼び出しにはパスプレフィックスが必要です。

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

## モジュール間通信

モジュール間で連携が必要な場合は、`rootState` と `rootGetters` でグローバル状態にアクセスするか、`dispatch` を使用して他のモジュールの action を呼び出します。

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
      // 他のモジュールの状態を読み取る
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

重要な詳細：`dispatch` の第3引数 `{ root: true }` により、名前空間モジュール内からルートレベルや他のモジュールの action を呼び出せます。

## まとめ

- `namespaced: true` を使用してモジュールの状態を分離し、名前の競合を防ぎます
- 定数ファイルで mutation と action の名前を一元管理し、IDE フレンドリで検索可能にします
- モジュール間の通信は `rootState` で状態を読み取り、`dispatch` に `{ root: true }` を指定して他のモジュールを呼び出します
- `createNamespacedHelpers` を使用すると、コンポーネント内での名前空間モジュールのマッピングが簡略化されます
