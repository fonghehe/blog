---
title: "Vue Router 4新機能プレビュー"
date: 2019-12-11 15:12:11
tags:
  - Vue
readingTime: 3
description: "随着 Vue 3 进入 alpha/beta 阶段，Vue Router 4 也在同步开发中。Vue Router 4 不仅仅是 Vue 3 的适配版本，它用 TypeScript 完全重写，API 做了大量简化，并且原生支持 Composition API。这篇文章基于 Vue Router 4 的 RFC 和早期代"
wordCount: 396
---

随着 Vue 3 进入 alpha/beta 阶段，Vue Router 4 也在同步开发中。Vue Router 4 不仅仅是 Vue 3 的适配版本，它用 TypeScript 完全重写，API 做了大量简化，并且原生支持 Composition API。这篇文章基于 Vue Router 4 的 RFC 和早期代码，梳理主要变化。

## TypeScriptで書き直す

Vue Router 3 的类型定义是后期补上的（`@types/vue-router`），类型推导经常出问题。Vue Router 4 从源码开始就用 TypeScript 编写，类型定义与代码同步：

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

## createRouterがnew VueRouterに代わる

Vue Router 4 采用了 Vue 3 的函数式风格，不再通过 `new` 创建实例：

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

## Composition APIサポート

这是 Vue Router 4 最重要的新特性。在 `setup()` 中可以通过 `useRoute` 和 `useRouter` 获取路由信息和方法，不再需要 `this.$route`：

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

## 動的ルートの変更

Vue Router 4 对动态路由的 API 做了简化：

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

## ルートガードの変更

路由守卫的 API 基本保持不变，但类型更完善，`next` 函数不再是必须的：

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

## まとめ

- Vue Router 4 用 TypeScript 完全重写，类型推导完整，告别 `@types/vue-router`
- `createRouter` + `createWebHistory` 替代 `new VueRouter`，与 Vue 3 函数式风格统一
- `useRoute` / `useRouter` 让 Composition API 中获取路由信息不再依赖 `this`
- `addRoute` 替代 `addRoutes`，动态路由管理更灵活
- 路由守卫支持返回值代替 `next()` 调用，代码更简洁
- 组件内守卫通过 `onBeforeRouteLeave` / `onBeforeRouteUpdate` 在 `setup` 中使用
- Vue Router 4 与 Vue 3 同步发布，建议提前学习，为迁移做准备
