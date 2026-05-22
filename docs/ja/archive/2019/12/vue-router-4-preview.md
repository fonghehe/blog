---
title: "Vue Router 4新機能プレビュー"
date: 2019-12-11 15:12:11
tags:
  - Vue
readingTime: 4
description: "Vue 3 が alpha/beta 段階に入るにつれて、Vue Router 4 も同時に開発が進められています。Vue Router 4 は単なる Vue 3 の対応バージョンではなく、TypeScript で完全に書き直され、API が大幅に簡略化され、Composition API をネイティブサポートしています。この記事では Vue Router 4 の RFC と初期コードに基づいて新機能を紹介します。"
wordCount: 577
---

Vue 3 が alpha/beta 段階に入るにつれて、Vue Router 4 も同時に開発が進められています。Vue Router 4 は単なる Vue 3 の対応バージョンではなく、TypeScript で完全に書き直され、API が大幅に簡略化され、Composition API をネイティブサポートしています。この記事では Vue Router 4 の RFC と初期コードに基づいて主要な変更点を整理します。

## TypeScriptで書き直す

Vue Router 3 の型定義は後付け（`@types/vue-router`）であり、型推論に問題が生じることがよくありました。Vue Router 4 はソースコードから TypeScript で記述されており、型定義がコードと同期しています：

```typescript
// Vue Router 3 の型推論（不完全）
import VueRouter, { Route, RouteConfig } from 'vue-router'

// ナビゲーションガードの型が不十分
const guard = (to: Route, from: Route, next: Function) => {
  // next は Function 型であり、オーバーロードのヒントがない
  next()
}

// Vue Router 4 の型（ネイティブ TypeScript）
import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'

// ルート設定は完全な型推論が効く
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    // meta はジェネリクスをサポート
    meta: { requiresAuth: true, roles: ['admin', 'user'] }
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => import('@/views/User.vue'),
    props: true
  }
]

// ナビゲーションガードの型が完全
const guard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
}
```

## createRouterがnew VueRouterに代わる

Vue Router 4 は Vue 3 の関数型スタイルを採用し、`new` によるインスタンス作成ではなくなりました：

```typescript
// Vue Router 3
import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About }
  ]
})

export default router

// main.js にて
new Vue({
  router,
  render: h => h(App)
}).$mount('#app')

// ====== Vue Router 4 ======
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

// History モードは文字列設定ではなく、ファクトリ関数で選択
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  // または createWebHashHistory() でハッシュモード
  routes: [
    { path: '/', component: () => import('@/views/Home.vue') },
    { path: '/about', component: () => import('@/views/About.vue') }
  ]
})

// main.js にて
import { createApp } from 'vue'
const app = createApp(App)
app.use(router)
app.mount('#app')
```

## Composition APIサポート

これは Vue Router 4 の最も重要な新機能です。`setup()` 内で `useRoute` と `useRouter` を使用してルート情報やメソッドを取得でき、`this.$route` が不要になります：

```typescript
import { defineComponent, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  setup() {
    const route = useRoute()
    const router = useRouter()

    // ルートパラメータを取得（リアクティブ）
    const userId = computed(() => route.params.id)
    const userName = ref('')

    // ルートパラメータの変更を監視
    watch(
      () => route.params.id,
      async (newId) => {
        if (newId) {
          const user = await fetchUser(newId)
          userName.value = user.name
        }
      },
      { immediate: true }
    )

    // プログラムによるナビゲーション
    function goToProfile() {
      router.push({
        name: 'Profile',
        params: { id: userId.value }
      })
    }

    function goBack() {
      router.back()
    }

    // 現在のルートを置き換え（履歴に残さない）
    function replaceRoute() {
      router.replace({ query: { tab: 'settings' } })
    }

    return {
      userId,
      userName,
      goToProfile,
      goBack,
      replaceRoute
    }
  }
})
```

## 動的ルートの変更

Vue Router 4 では動的ルートの API が簡略化されました：

```typescript
import { createRouter } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/Home.vue')
    }
  ]
})

// Vue Router 3 で動的ルートを追加
// router.addRoutes([
//   { path: '/admin', component: Admin }
// ])

// Vue Router 4: addRoutes は削除され、addRoute（単数形）に統一
// 単一ルートを追加
router.addRoute({
  path: '/admin',
  name: 'Admin',
  component: () => import('@/views/Admin.vue'),
  meta: { requiresAdmin: true }
})

// 子ルートを追加
router.addRoute('Admin', {
  path: 'users',
  name: 'AdminUsers',
  component: () => import('@/views/admin/Users.vue')
})

// ルートが存在するか確認
router.hasRoute('Admin') // true

// すべてのルートレコードを取得
router.getRoutes().forEach(route => {
  console.log(route.path, route.name)
})

// ルートを削除
router.removeRoute('Admin')

// 典型的な使用例：ユーザー権限に応じて動的にルートを追加
async function setupRoutesByPermission(userRole) {
  if (userRole === 'admin') {
    router.addRoute({
      path: '/admin',
      component: () => import('@/views/Admin.vue'),
      children: [
        {
          path: 'users',
          component: () => import('@/views/admin/Users.vue')
        },
        {
          path: 'settings',
          component: () => import('@/views/admin/Settings.vue')
        }
      ]
    })
  }
}
```

## ルートガードの変更

ルートガードの API は基本的に変わりませんが、型がより充実し、`next` 関数は必須ではなくなりました：

```typescript
// Vue Router 3：next() の呼び出しが必須
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})

// Vue Router 4：next は依然としてオプションパラメータだが、呼び出さなくてもよい
// next() の代わりに直接戻り値を返す
router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    // next('/login') の代わりにルートアドレスを返す
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  // true または undefined を返すと通過
  return true
})

// false を返すとナビゲーションをキャンセル
router.beforeEach((to) => {
  if (to.path === '/dangerous') {
    return false
  }
})

// ルート専用ガード
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
    beforeEnter: (to, from) => {
      // ログインページからの場合のみ通過を許可
      if (from.name !== 'Login') {
        return { name: 'Login' }
      }
    }
  }
]

// コンポーネント内ガード（Composition API スタイル）
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 現在のルートを離れる前
    onBeforeRouteLeave((to, from) => {
      // フォームが未保存の場合は確認
      if (hasUnsavedChanges()) {
        return window.confirm('未保存の変更がありますが、本当に移動しますか？')
      }
    })

    // 現在のルートパラメータが変更されたとき
    onBeforeRouteUpdate(async (to, from) => {
      // params.id が変更された場合のみ再読み込み
      if (to.params.id !== from.params.id) {
        await loadData(to.params.id)
      }
    })
  }
}
```

## まとめ

- Vue Router 4 は TypeScript で完全に書き直され、型推論が充実し、`@types/vue-router` から卒業
- `createRouter` + `createWebHistory` が `new VueRouter` に代わり、Vue 3 の関数型スタイルに統一
- `useRoute` / `useRouter` により、Composition API 内でルート情報を取得する際に `this` が不要に
- `addRoute` が `addRoutes` に代わり、動的ルート管理がより柔軟に
- ルートガードは `next()` の代わりに戻り値をサポートし、コードがより簡潔に
- コンポーネント内ガードは `onBeforeRouteLeave` / `onBeforeRouteUpdate` で `setup` 内で使用
- Vue Router 4 は Vue 3 と同時にリリースされるため、移行に備えて事前の学習を推奨
