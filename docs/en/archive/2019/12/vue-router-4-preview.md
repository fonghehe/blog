---
title: "Vue Router 4 New Features Preview"
date: 2019-12-11 15:12:11
tags:
  - Vue
readingTime: 3
description: "As Vue 3 enters its alpha/beta stage, Vue Router 4 is being developed in parallel. Vue Router 4 is more than just an adaptation for Vue 3—it is fully rewritten in TypeScript, its API is greatly simplified, and it supports the Composition API natively. Based on the Vue Router 4 RFC and early code, this article walks through the major changes."
wordCount: 275
---

As Vue 3 enters its alpha/beta stage, Vue Router 4 is being developed in parallel. Vue Router 4 is more than just an adaptation for Vue 3—it is fully rewritten in TypeScript, its API is greatly simplified, and it supports the Composition API natively. Based on the Vue Router 4 RFC and early code, this article walks through the major changes.

## Rewritten in TypeScript

Vue Router 3's type definitions were bolted on later (`@types/vue-router`), and type inference was often unreliable. Vue Router 4 is written in TypeScript from the source up, so the type definitions stay in sync with the code:

```typescript
// Vue Router 3 的类型推导（不完整）
import VueRouter, { Route, RouteConfig } from 'vue-router'

// 导航守卫的类型不够精确
const guard = (to: Route, from: Route, next: Function) => {
  // next 是 Function 类型，没有重载提示
  next()
}

// Vue Router 4 的类型（原生 TypeScript）
import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized
} from 'vue-router'

// 路由配置有完整的类型推导
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
    // meta 现在支持泛型
    meta: { requiresAuth: true, roles: ['admin', 'user'] }
  },
  {
    path: '/user/:id',
    name: 'User',
    component: () => import('@/views/User.vue'),
    props: true
  }
]

// 导航守卫类型完整
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

## createRouter Replaces new VueRouter

Vue Router 4 adopts Vue 3's functional style and no longer creates an instance via `new`:

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

// History 模式通过工厂函数选择，而非字符串配置
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  // 或 createWebHashHistory() 用于 hash 模式
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

## Composition API Support

This is the most important new feature in Vue Router 4. Inside `setup()` you get route info and methods through `useRoute` and `useRouter`, with no need for `this.$route`:

```typescript
import { defineComponent, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export default defineComponent({
  setup() {
    const route = useRoute()
    const router = useRouter()

    // 获取路由参数（响应式）
    const userId = computed(() => route.params.id)
    const userName = ref('')

    // 监听路由参数变化
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

    // 编程式导航
    function goToProfile() {
      router.push({
        name: 'Profile',
        params: { id: userId.value }
      })
    }

    function goBack() {
      router.back()
    }

    // 替换当前路由（不产生历史记录）
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

## Dynamic Route Changes

Vue Router 4 simplifies the dynamic-route API:

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

// Vue Router 3 添加动态路由
// router.addRoutes([
//   { path: '/admin', component: Admin }
// ])

// Vue Router 4: addRoutes 已移除，统一使用 addRoute（单数）
// 添加单条路由
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

// 检查路由是否存在
router.hasRoute('Admin') // true

// 获取所有路由记录
router.getRoutes().forEach(route => {
  console.log(route.path, route.name)
})

// 移除路由
router.removeRoute('Admin')

// 典型用法：根据用户权限动态添加路由
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

## Route Guard Changes

The route-guard API is essentially unchanged, but the types are more complete and the `next` function is no longer required:

```typescript
// Vue Router 3：必须调用 next()
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    next('/login')
  } else {
    next()
  }
})

// Vue Router 4：next 仍是可选参数，但可以不调用
// 直接返回值代替 next() 调用
router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !isAuthenticated()) {
    // 返回路由地址代替 next('/login')
    return { name: 'Login', query: { redirect: to.fullPath } }
  }
  // 返回 true 或 undefined 表示放行
  return true
})

// 返回 false 表示取消导航
router.beforeEach((to) => {
  if (to.path === '/dangerous') {
    return false
  }
})

// 路由独享守卫
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
    beforeEnter: (to, from) => {
      // 只有从登录页来才放行
      if (from.name !== 'Login') {
        return { name: 'Login' }
      }
    }
  }
]

// 组件内守卫（Composition API 风格）
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 离开当前路由前
    onBeforeRouteLeave((to, from) => {
      // 表单未保存时提示
      if (hasUnsavedChanges()) {
        return window.confirm('有未保存的更改，确定离开吗？')
      }
    })

    // 当前路由参数变化时
    onBeforeRouteUpdate(async (to, from) => {
      // 仅 params.id 变化时重新加载
      if (to.params.id !== from.params.id) {
        await loadData(to.params.id)
      }
    })
  }
}
```

## Summary

- Vue Router 4 is fully rewritten in TypeScript with complete type inference—farewell to `@types/vue-router`
- `createRouter` + `createWebHistory` replace `new VueRouter`, unifying with Vue 3's functional style
- `useRoute` / `useRouter` let the Composition API access route info without relying on `this`
- `addRoute` replaces `addRoutes`, making dynamic-route management more flexible
- Route guards can return a value instead of calling `next()`, making the code cleaner
- In-component guards are used in `setup` via `onBeforeRouteLeave` / `onBeforeRouteUpdate`
- Vue Router 4 ships alongside Vue 3; it's wise to learn it early to prepare for migration
