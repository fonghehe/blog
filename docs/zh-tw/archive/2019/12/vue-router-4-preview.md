---
title: "Vue Router 4 新特性預覽"
date: 2019-12-11 15:12:11
tags:
  - Vue
readingTime: 3
description: "隨著 Vue 3 進入 alpha/beta 階段，Vue Router 4 也在同步開發中。Vue Router 4 不僅僅是 Vue 3 的適配版本，它用 TypeScript 完全重寫，API 做了大量簡化，並且原生支援 Composition API。這篇文章基於 Vue Router 4 的 RFC 和早期程"
wordCount: 389
---

隨著 Vue 3 進入 alpha/beta 階段，Vue Router 4 也在同步開發中。Vue Router 4 不僅僅是 Vue 3 的適配版本，它用 TypeScript 完全重寫，API 做了大量簡化，並且原生支援 Composition API。這篇文章基於 Vue Router 4 的 RFC 和早期程式碼，梳理主要變化。

## TypeScript 重寫

Vue Router 3 的型別定義是後期補上的（`@types/vue-router`），型別推導經常出問題。Vue Router 4 從原始碼開始就用 TypeScript 編寫，型別定義與程式碼同步：

```typescript
// Vue Router 3 的型別推導（不完整）
import VueRouter, { Route, RouteConfig } from 'vue-router'

// 導航守衛的型別不夠精確
const guard = (to: Route, from: Route, next: Function) => {
  // next 是 Function 型別，沒有過載提示
  next()
}

// Vue Router 4 的型別（原生 TypeScript）
import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'

// 路由配置有完整的型別推導
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    // meta 現在支援泛型
    meta: { requiresAuth: true, roles: ['admin', 'user'] }
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => import('@/views/User.vue'),
    props: true
  }
]

// 導航守衛型別完整
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

## createRouter 替代 new VueRouter

Vue Router 4 採用了 Vue 3 的函式式風格，不再通過 `new` 建立例項：

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

// 在 main.js 中
new Vue({
  router,
  render: h => h(App)
}).$mount('#app')

// ====== Vue Router 4 ======
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

// History 模式通過工廠函式選擇，而非字串配置
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  // 或 createWebHashHistory() 用於 hash 模式
  routes: [
    { path: '/', component: () => import('@/views/Home.vue') },
    { path: '/about', component: () => import('@/views/About.vue') }
  ]
})

// 在 main.js 中
import { createApp } from 'vue'
const app = createApp(App)
app.use(router)
app.mount('#app')
```

## Composition API 支援

這是 Vue Router 4 最重要的新特性。在 `setup()` 中可以通過 `useRoute` 和 `useRouter` 獲取路由資訊和方法，不再需要 `this.$route`：

```typescript
import { defineComponent, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  setup() {
    const route = useRoute()
    const router = useRouter()

    // 獲取路由引數（響應式）
    const userId = computed(() => route.params.id)
    const userName = ref('')

    // 監聽路由引數變化
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

    // 程式設計式導航
    function goToProfile() {
      router.push({
        name: 'Profile',
        params: { id: userId.value }
      })
    }

    function goBack() {
      router.back()
    }

    // 替換當前路由（不產生歷史記錄）
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

## 動態路由的變化

Vue Router 4 對動態路由的 API 做了簡化：

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

// Vue Router 3 新增動態路由
// router.addRoutes([
//   { path: '/admin', component: Admin }
// ])

// Vue Router 4: addRoutes 已移除，統一使用 addRoute（單數）
// 新增單條路由
router.addRoute({
  path: '/admin',
  name: 'Admin',
  component: () => import('@/views/Admin.vue'),
  meta: { requiresAdmin: true }
})

// 新增子路由
router.addRoute('Admin', {
  path: 'users',
  name: 'AdminUsers',
  component: () => import('@/views/admin/Users.vue')
})

// 檢查路由是否存在
router.hasRoute('Admin') // true

// 獲取所有路由記錄
router.getRoutes().forEach(route => {
  console.log(route.path, route.name)
})

// 移除路由
router.removeRoute('Admin')

// 典型用法：根據使用者許可權動態新增路由
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

## 路由守衛的變化

路由守衛的 API 基本保持不變，但型別更完善，`next` 函式不再是必須的：

```typescript
// Vue Router 3：必須呼叫 next()
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})

// Vue Router 4：next 仍是可選引數，但可以不呼叫
// 直接返回值代替 next() 呼叫
router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    // 返回路由地址代替 next('/login')
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  // 返回 true 或 undefined 表示放行
  return true
})

// 返回 false 表示取消導航
router.beforeEach((to) => {
  if (to.path === '/dangerous') {
    return false
  }
})

// 路由獨享守衛
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
    beforeEnter: (to, from) => {
      // 隻有從登入頁來才放行
      if (from.name !== 'Login') {
        return { name: 'Login' }
      }
    }
  }
]

// 元件內守衛（Composition API 風格）
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 離開當前路由前
    onBeforeRouteLeave((to, from) => {
      // 表單未儲存時提示
      if (hasUnsavedChanges()) {
        return window.confirm('有未儲存的更改，確定離開嗎？')
      }
    })

    // 當前路由引數變化時
    onBeforeRouteUpdate(async (to, from) => {
      // 僅 params.id 變化時重新載入
      if (to.params.id !== from.params.id) {
        await loadData(to.params.id)
      }
    })
  }
}
```

## 小結

- Vue Router 4 用 TypeScript 完全重寫，型別推導完整，告別 `@types/vue-router`
- `createRouter` + `createWebHistory` 替代 `new VueRouter`，與 Vue 3 函式式風格統一
- `useRoute` / `useRouter` 讓 Composition API 中獲取路由資訊不再依賴 `this`
- `addRoute` 替代 `addRoutes`，動態路由管理更靈活
- 路由守衛支援返回值代替 `next()` 呼叫，程式碼更簡潔
- 元件內守衛通過 `onBeforeRouteLeave` / `onBeforeRouteUpdate` 在 `setup` 中使用
- Vue Router 4 與 Vue 3 同步釋出，建議提前學習，為遷移做準備
