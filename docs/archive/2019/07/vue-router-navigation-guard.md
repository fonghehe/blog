---
title: "Vue Router 导航守卫完整指南"
date: 2019-07-03 10:02:55
tags:
  - Vue
readingTime: 5
description: "做后台管理系统绕不开的话题就是路由权限控制。Vue Router 提供了完善的导航守卫机制，但 `beforeEach`、`beforeResolve`、`afterEach` 三个全局守卫加上路由独享守卫和组件内守卫，执行顺序和适用场景很多人搞不清楚。这篇文章把导航守卫彻底讲透。"
---

做后台管理系统绕不开的话题就是路由权限控制。Vue Router 提供了完善的导航守卫机制，但 `beforeEach`、`beforeResolve`、`afterEach` 三个全局守卫加上路由独享守卫和组件内守卫，执行顺序和适用场景很多人搞不清楚。这篇文章把导航守卫彻底讲透。

## 导航守卫全景图

Vue Router 的守卫分为三层：

**全局守卫**（router 实例上注册）：
- `router.beforeEach` — 全局前置守卫
- `router.beforeResolve` — 全局解析守卫
- `router.afterEach` — 全局后置守卫

**路由独享守卫**（写在路由配置中）：
- `beforeEnter`

**组件内守卫**（写在组件内）：
- `beforeRouteEnter`
- `beforeRouteUpdate`
- `beforeRouteLeave`

完整的执行顺序（从 A 页面导航到 B 页面）：

```
1. A 组件的 beforeRouteLeave
2. 全局 beforeEach
3. B 路由的 beforeEnter
4. B 组件的 beforeRouteEnter
5. 全局 beforeResolve
6. 全局 afterEach
7. DOM 更新
8. B 组件的 beforeRouteEnter 中 next(vm => {}) 的回调
```

## beforeEach：最常用的守卫

几乎所有权限控制逻辑都在这里处理：

```javascript
// router/index.js
const router = new VueRouter({
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: Layout,
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
          meta: { title: '首页' }
        },
        {
          path: 'users',
          name: 'UserList',
          component: () => import('@/views/users/List.vue'),
          meta: { title: '用户管理', roles: ['admin', 'editor'] }
        },
        {
          path: 'settings',
          name: 'Settings',
          component: () => import('@/views/Settings.vue'),
          meta: { title: '系统设置', roles: ['admin'] }
        }
      ]
    },
    {
      path: '/403',
      name: 'Forbidden',
      component: () => import('@/views/403.vue'),
      meta: { public: true }
    },
    {
      path: '*',
      name: 'NotFound',
      component: () => import('@/views/404.vue'),
      meta: { public: true }
    }
  ]
})
```

基础的登录验证：

```javascript
const whiteList = ['/login', '/403', '/404']

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  // 1. 公开页面直接放行
  if (to.meta.public || whiteList.includes(to.path)) {
    return next()
  }

  // 2. 没有 token，跳转登录页
  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 3. 有 token，继续导航
  next()
})
```

上面是基础版本，但实际项目中远比这复杂——我们需要在 `beforeEach` 中同时处理 token 验证、用户信息获取、动态路由生成等逻辑。

## 完整的权限控制方案

一个典型的后台管理系统，用户登录后获取用户信息和权限，根据权限动态生成可访问的路由：

```javascript
// store/modules/user.js
const state = {
  token: localStorage.getItem('token'),
  userInfo: null,
  roles: [],
  permissions: []
}

const mutations = {
  SET_TOKEN(state, token) {
    state.token = token
    localStorage.setItem('token', token)
  },
  SET_USER_INFO(state, info) {
    state.userInfo = info
    state.roles = info.roles || []
    state.permissions = info.permissions || []
  },
  LOGOUT(state) {
    state.token = null
    state.userInfo = null
    state.roles = []
    state.permissions = []
    localStorage.removeItem('token')
  }
}

const actions = {
  async getUserInfo({ commit, state }) {
    if (state.userInfo) return state.userInfo
    const res = await api.getUserInfo()
    commit('SET_USER_INFO', res.data)
    return res.data
  }
}
```

```javascript
// router/index.js
import store from '@/store'
import { asyncRoutes } from './routes'

let isDynamicRoutesAdded = false

router.beforeEach(async (to, from, next) => {
  const token = store.state.user.token

  // 白名单页面
  if (to.meta.public) {
    return next()
  }

  // 没有 token
  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 已登录且动态路由已添加
  if (isDynamicRoutesAdded) {
    return next()
  }

  try {
    // 获取用户信息
    const userInfo = await store.dispatch('user/getUserInfo')

    // 根据角色生成可访问路由
    const accessibleRoutes = filterRoutesByRole(asyncRoutes, userInfo.roles)

    // 动态添加路由
    accessibleRoutes.forEach(route => {
      router.addRoute(route)
    })

    // 添加 404 兜底路由（必须最后添加）
    router.addRoute({
      path: '*',
      redirect: '/404'
    })

    isDynamicRoutesAdded = true

    // hack: 确保路由已添加完成
    next({ ...to, replace: true })
  } catch (error) {
    store.commit('user/LOGOUT')
    next({ path: '/login', query: { redirect: to.fullPath } })
  }
})

function filterRoutesByRole(routes, roles) {
  return routes.filter(route => {
    if (route.meta && route.meta.roles) {
      return roles.some(role => route.meta.roles.includes(role))
    }
    return true
  }).map(route => {
    if (route.children) {
      return { ...route, children: filterRoutesByRole(route.children, roles) }
    }
    return route
  })
}
```

## meta 字段的妙用

`meta` 字段可以承载很多路由元信息，不仅仅是权限控制：

```javascript
{
  path: 'article/edit/:id',
  name: 'ArticleEdit',
  component: () => import('@/views/article/Edit.vue'),
  meta: {
    title: '编辑文章',
    icon: 'edit',
    roles: ['admin', 'editor'],
    keepAlive: true,       // 是否缓存组件
    breadcrumb: true,       // 是否显示在面包屑中
    showInMenu: true,       // 是否在侧边栏菜单中显示
    noPadding: true         // 页面内容区域不加 padding
  }
}
```

然后在各个地方使用这些 meta 信息：

```javascript
// 全局后置守卫 - 设置页面标题
router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} - 后台管理系统`
    : '后台管理系统'
})
```

```html
<!-- App.vue 中根据 meta 控制 keep-alive -->
<template>
  <div id="app">
    <keep-alive :include="cachedViews">
      <router-view />
    </keep-alive>
  </div>
</template>

<script>
export default {
  computed: {
    cachedViews() {
      return this.$store.state.permission.cachedViews
    }
  }
}
</script>
```

## beforeRouteLeave：页面离开确认

表单编辑页面，用户修改了内容但没保存就离开，需要弹出确认框：

```javascript
export default {
  data() {
    return {
      form: { title: '', content: '' },
      isModified: false
    }
  },
  watch: {
    form: {
      handler() {
        this.isModified = true
      },
      deep: true
    }
  },
  methods: {
    save() {
      api.saveArticle(this.form).then(() => {
        this.isModified = false
        this.$router.push('/articles')
      })
    }
  },
  beforeRouteLeave(to, from, next) {
    if (this.isModified) {
      this.$confirm('内容未保存，确定离开吗？', '提示', {
        type: 'warning'
      }).then(() => next()).catch(() => next(false))
    } else {
      next()
    }
  }
}
```

## 踩坑记录

### 坑 1：redirect 死循环

```javascript
// 错误写法 —— 无限循环
router.beforeEach((to, from, next) => {
  if (!token) {
    next('/login')
    // 即使跳转到 /login，beforeEach 仍然会执行
    // 如果 /login 不在白名单中，又会 redirect → 死循环
  }
  next()
})
```

解决方案：确保 `/login` 在白名单中，并且在检查 token 之前先判断是否在白名单里。顺序很重要。

### 坑 2：next() 调用多次

```javascript
// 错误写法
router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    next() // 第一次调用
  }
  next() // 第二次调用 —— 报错！
})

// 正确写法
router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    return next() // return 退出函数
  }
  next()
})
```

### 坑 3：动态路由刷新后 404

`router.addRoute` 添加的路由是运行时的，页面刷新后就丢了。所以上面代码中用 `isDynamicRoutesAdded` 标志来控制，刷新后会重新走一遍 `getUserInfo` + `addRoute` 流程。

但要注意：刷新时 Vue Router 会立即尝试匹配当前 URL，此时动态路由还没添加，会匹配到 `*` 通配路由（404）。解决方法是把 `*` 路由放在 `addRoute` 之后添加，并且在路由守卫中用 `next({ ...to, replace: true })` 重新触发一次导航。

### 坑 4：beforeRouteLeave 中 this 指向

组件内守卫 `beforeRouteLeave` 中可以访问 `this`，但如果用箭头函数定义就会有问题：

```javascript
// 错误
beforeRouteLeave: (to, from, next) => {
  console.log(this.isModified) // this 不是组件实例！
}

// 正确
beforeRouteLeave(to, from, next) {
  console.log(this.isModified) // this 是组件实例
}
```

### 坑 5：beforeEach 中的异步操作

```javascript
// 常见问题：异步操作没有正确处理
router.beforeEach((to, from, next) => {
  checkAuth().then(() => {
    next() // 异步回调中调用
  })
  // 没有 return，函数同步执行完毕
})

// 建议写法：用 async/await
router.beforeEach(async (to, from, next) => {
  if (to.meta.public) return next()

  try {
    await checkAuth()
    next()
  } catch (e) {
    next('/login')
  }
})
```

## 小结

- 导航守卫的执行顺序是：组件离开守卫 -> 全局 beforeEach -> 路由 beforeEnter -> 组件进入守卫 -> 全局 beforeResolve -> 全局 afterEach
- 权限控制的核心逻辑放在 `beforeEach` 中，配合 `meta` 字段声明路由所需的权限
- 动态路由方案：登录后根据角色调用 `router.addRoute`，刷新时需要重新执行
- `next()` 必须且只能调用一次，用 `return next()` 避免多次调用
- 页面离开确认用 `beforeRouteLeave`，结合数据修改状态判断
- 异步守卫优先用 `async/await`，避免回调地狱和时序问题
