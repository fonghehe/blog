---
title: "Pinia：Vue 3 の次世代状態管理"
date: 2021-07-05 10:05:15
tags:
  - Vue
  - TypeScript

readingTime: 3
description: "Vuex 4 も使えますが、記述にどうしても違和感がありました。Pinia は Vue コアチームメンバーが開発した新しい状態管理ライブラリで、API デザインは Vuex よりはるかに洗練されています。Vue 3 プロジェクトで2ヶ月以上使用した経験を共有します。"
wordCount: 521
---

Vuex 4 も使えますが、書いていてどうも違和感がありました。Pinia は Vue コアチームのメンバーが開発した新しい状態管理ライブラリで、API デザインが Vuex よりはるかに洗練されています。Vue 3 プロジェクトで 2 ヶ月以上使用した経験を共有します。

## なぜ Vuex 4 を使わないのか

Vuex 4 は Vue 3 で動作しますが、核心的な問題は解決されていません：

- TypeScript のサポートが弱い（多くの型体操が必要）
- mutations と actions が分離しており、ほとんどの場合 mutation は単なる代入
- モジュールシステムが複雑（namespace、modules のネスト）

Pinia は mutations を完全に廃止し、actions が同期・非同期操作を統一的に処理します。

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
  // state は関数で返す（Vue 3 コンポーネントの data と同じ）
  state: (): UserState => ({
    name: '',
    token: null,
    permissions: [],
  }),

  getters: {
    // 戻り値の型は自動推論、手動宣言不要
    isAdmin: (state) => state.permissions.includes('admin'),

    // getter は他の getter に依存可能
    greeting: (state) => `欢迎回来，${state.name}`,
  },

  actions: {
    // mutation は不要、state を直接変更
    async login(username: string, password: string) {
      const res = await api.login(username, password)
      this.token = res.token
      this.name = res.name
      this.permissions = res.permissions
    },

    logout() {
      this.$reset() // 初期状態にリセット
    },
  },
})
```

## コンポーネントでの使用

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'

const userStore = useUserStore()

// 分割代入するとリアクティビティが失われるので、storeToRefs を使う
const { name, isAdmin } = storeToRefs(userStore)

// actions はそのまま分割代入でOK（通常の関数）
const { login, logout } = userStore

// state に直接アクセス
console.log(userStore.token)

// state を直接変更（DevTools で追跡可能）
userStore.name = '张三'
</script>
```

## Vuex との比較

```typescript
// Vuex：mutation を書く必要がある
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
      commit('SET_COUNT', res.count) // mutation 経由でなければならない
    },
  },
})

// Pinia：直接変更
export const useCountStore = defineStore('count', {
  state: () => ({ count: 0 }),
  actions: {
    async fetchCount() {
      const res = await api.getCount()
      this.count = res.count // 直接代入
    },
  },
})
```

## Store の組み合わせ（Vuex modules の代替）

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
      // 他の store を直接呼び出す
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

namespaced も rootGetters も不要で、import するだけで使えます。

## 開発ツール統合

Pinia は DevTools に対応しており、Vue DevTools で以下の情報を確認できます：

- 各 store の state の変化
- タイムトラベルデバッグ
- state 変更後のリアルタイム更新

## Tailwind CSS JIT との組み合わせのコツ

Pinia が状態を管理し、Tailwind がスタイルを管理する、自然な連携です：

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

## まとめ

- Pinia は Vue 3 の状態管理の未来であり、Vuex 5 は Pinia のデザインをベースにする
- mutations を廃止、TypeScript をネイティブサポート、API はよりシンプルに
- Store 間は直接 import して呼び出せ、Vuex modules のようなネストは不要
- 新規プロジェクトには最適；既存プロジェクトからの移行コストも低い（状態ロジックは段階的に移行可能）
