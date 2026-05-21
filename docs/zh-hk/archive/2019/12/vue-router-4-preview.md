---
title: "Vue Router 4 新特性預覽"
date: 2019-12-11 15:12:11
tags:
  - Vue
readingTime: 3
description: "隨着 Vue 3 進入 alpha/beta 階段，Vue Router 4 也在同步開發中。Vue Router 4 不僅僅是 Vue 3 的適配版本，它用 TypeScript 完全重寫，API 做了大量簡化，並且原生支持 Composition API。這篇文章基於 Vue Router 4 的 RFC 和早期代"
wordCount: 385
---

隨着 Vue 3 進入 alpha/beta 階段，Vue Router 4 也在同步開發中。Vue Router 4 不僅僅是 Vue 3 的適配版本，它用 TypeScript 完全重寫，API 做了大量簡化，並且原生支持 Composition API。這篇文章基於 Vue Router 4 的 RFC 和早期代碼，梳理主要變化。

## TypeScript 重寫

Vue Router 3 的類型定義是後期補上的（`@types/vue-router`），類型推導經常出問題。Vue Router 4 從源碼開始就用 TypeScript 編寫，類型定義與代碼同步：

```typescript
// Vue Router 3 的類型推導（不完整）
import VueRouter, { Route, RouteConfig } from 'vue-router'

// 導航守衞的類型不夠精確
const guard = (to: Route, from: Route, next: Function) => {
  // next 是 Function 類型，沒有重載提示
  next()
}

// Vue Router 4 的類型（原生 TypeScript）
import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'

// 路由配置有完整的類型推導
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    // meta 現在支持泛型
    meta: { requiresAuth: true, roles: ['admin', 'user'] }
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => import('@/views/User.vue'),
    props: true
  }
]

// 導航守衞類型完整
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

Vue Router 4 採用了 Vue 3 的函數式風格，不再通過 `new` 創建實例：

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

// History 模式通過工廠函數選擇，而非字符串配置
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

## Composition API 支持

這是 Vue Router 4 最重要的新特性。在 `setup()` 中可以通過 `useRoute` 和 `useRouter` 獲取路由信息和方法，不再需要 `this.$route`：

```typescript
import { defineComponent, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  setup() {
    const route = useRoute()
    const router = useRouter()

    // 獲取路由參數（響應式）
    const userId = computed(() => route.params.id)
    const userName = ref('')

    // 監聽路由參數變化
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

    // 編程式導航
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

// Vue Router 3 添加動態路由
// router.addRoutes([
//   { path: '/admin', component: Admin }
// ])

// Vue Router 4: addRoutes 已移除，統一使用 addRoute（單數）
// 添加單條路由
router.addRoute({
  path: '/admin',
  name: 'Admin',
  component: () => import('@/views/Admin.vue'),
  meta: { requiresAdmin: true }
})

// 添加子路由
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

// 典型用法：根據用户權限動態添加路由
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

## 路由守衞的變化

路由守衞的 API 基本保持不變，但類型更完善，`next` 函數不再是必須的：

```typescript
// Vue Router 3：必須調用 next()
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})

// Vue Router 4：next 仍是可選參數，但可以不調用
// 直接返回值代替 next() 調用
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

// 路由獨享守衞
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
    beforeEnter: (to, from) => {
      // 只有從登錄頁來才放行
      if (from.name !== 'Login') {
        return { name: 'Login' }
      }
    }
  }
]

// 組件內守衞（Composition API 風格）
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 離開當前路由前
    onBeforeRouteLeave((to, from) => {
      // 表單未保存時提示
      if (hasUnsavedChanges()) {
        return window.confirm('有未保存的更改，確定離開嗎？')
      }
    })

    // 當前路由參數變化時
    onBeforeRouteUpdate(async (to, from) => {
      // 僅 params.id 變化時重新加載
      if (to.params.id !== from.params.id) {
        await loadData(to.params.id)
      }
    })
  }
}
```

## 小結

- Vue Router 4 用 TypeScript 完全重寫，類型推導完整，告別 `@types/vue-router`
- `createRouter` + `createWebHistory` 替代 `new VueRouter`，與 Vue 3 函數式風格統一
- `useRoute` / `useRouter` 讓 Composition API 中獲取路由信息不再依賴 `this`
- `addRoute` 替代 `addRoutes`，動態路由管理更靈活
- 路由守衞支持返回值代替 `next()` 調用，代碼更簡潔
- 組件內守衞通過 `onBeforeRouteLeave` / `onBeforeRouteUpdate` 在 `setup` 中使用
- Vue Router 4 與 Vue 3 同步發佈，建議提前學習，為遷移做準備
