---
title: "Vue Router 導航守衞完整指南：落地路徑與實戰建議"
date: 2019-07-03 10:02:55
tags:
  - Vue
readingTime: 5
description: "做後臺管理系統繞不開的話題就是路由權限控製。Vue Router 提供了完善的導航守衞機製，但 `beforeEach`、`beforeResolve`、`afterEach` 三個全局守衞加上路由獨享守衞和組件內守衞，執行順序和適用場景很多人搞不清楚。這篇文章把導航守衞徹底講透。"
wordCount: 777
---

做後臺管理系統繞不開的話題就是路由權限控製。Vue Router 提供了完善的導航守衞機製，但 `beforeEach`、`beforeResolve`、`afterEach` 三個全局守衞加上路由獨享守衞和組件內守衞，執行順序和適用場景很多人搞不清楚。這篇文章把導航守衞徹底講透。

## 導航守衞全景圖

Vue Router 的守衞分為三層：

**全局守衞**（router 實例上註冊）：
- `router.beforeEach` — 全局前置守衞
- `router.beforeResolve` — 全局解析守衞
- `router.afterEach` — 全局後置守衞

**路由獨享守衞**（寫在路由配置中）：
- `beforeEnter`

**組件內守衞**（寫在組件內）：
- `beforeRouteEnter`
- `beforeRouteUpdate`
- `beforeRouteLeave`

完整的執行順序（從 A 頁面導航到 B 頁面）：

```
1. A 組件的 beforeRouteLeave
2. 全局 beforeEach
3. B 路由的 beforeEnter
4. B 組件的 beforeRouteEnter
5. 全局 beforeResolve
6. 全局 afterEach
7. DOM 更新
8. B 組件的 beforeRouteEnter 中 next(vm => {}) 的回調
```

## beforeEach：最常用的守衞

幾乎所有權限控製邏輯都在這裏處理：

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
          meta: { title: '首頁' }
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
          meta: { title: '系統設置', roles: ['admin'] }
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

基礎的登錄驗證：

```javascript
const whiteList = ['/login', '/403', '/404']

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')

  // 1. 公開頁面直接放行
  if (to.meta.public || whiteList.includes(to.path)) {
    return next()
  }

  // 2. 沒有 token，跳轉登錄頁
  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 3. 有 token，繼續導航
  next()
})
```

上面是基礎版本，但實際項目中遠比這複雜——我們需要在 `beforeEach` 中同時處理 token 驗證、用户信息獲取、動態路由生成等邏輯。

## 完整的權限控製方案

一個典型的後臺管理系統，用户登錄後獲取用户信息和權限，根據權限動態生成可訪問的路由：

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

  // 白名單頁面
  if (to.meta.public) {
    return next()
  }

  // 沒有 token
  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 已登錄且動態路由已添加
  if (isDynamicRoutesAdded) {
    return next()
  }

  try {
    // 獲取用户信息
    const userInfo = await store.dispatch('user/getUserInfo')

    // 根據角色生成可訪問路由
    const accessibleRoutes = filterRoutesByRole(asyncRoutes, userInfo.roles)

    // 動態添加路由
    accessibleRoutes.forEach(route => {
      router.addRoute(route)
    })

    // 添加 404 兜底路由（必須最後添加）
    router.addRoute({
      path: '*',
      redirect: '/404'
    })

    isDynamicRoutesAdded = true

    // hack: 確保路由已添加完成
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

`meta` 字段可以承載很多路由元信息，不僅僅是權限控製：

```javascript
{
  path: 'article/edit/:id',
  name: 'ArticleEdit',
  component: () => import('@/views/article/Edit.vue'),
  meta: {
    title: '編輯文章',
    icon: 'edit',
    roles: ['admin', 'editor'],
    keepAlive: true,       // 是否緩存組件
    breadcrumb: true,       // 是否顯示在麪包屑中
    showInMenu: true,       // 是否在側邊欄菜單中顯示
    noPadding: true         // 頁面內容區域不加 padding
  }
}
```

然後在各個地方使用這些 meta 信息：

```javascript
// 全局後置守衞 - 設置頁面標題
router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} - 後臺管理系統`
    : '後臺管理系統'
})
```

```html
<!-- App.vue 中根據 meta 控製 keep-alive -->
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

## beforeRouteLeave：頁面離開確認

表單編輯頁面，用户修改了內容但沒保存就離開，需要彈出確認框：

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
      this.$confirm('內容未保存，確定離開嗎？', '提示', {
        type: 'warning'
      }).then(() => next()).catch(() => next(false))
    } else {
      next()
    }
  }
}
```

## 踩坑記錄

### 坑 1：redirect 死循環

```javascript
// 錯誤寫法 —— 無限循環
router.beforeEach((to, from, next) => {
  if (!token) {
    next('/login')
    // 即使跳轉到 /login，beforeEach 仍然會執行
    // 如果 /login 不在白名單中，又會 redirect → 死循環
  }
  next()
})
```

解決方案：確保 `/login` 在白名單中，並且在檢查 token 之前先判斷是否在白名單裏。順序很重要。

### 坑 2：next() 調用多次

```javascript
// 錯誤寫法
router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    next() // 第一次調用
  }
  next() // 第二次調用 —— 報錯！
})

// 正確寫法
router.beforeEach((to, from, next) => {
  if (to.meta.public) {
    return next() // return 退出函數
  }
  next()
})
```

### 坑 3：動態路由刷新後 404

`router.addRoute` 添加的路由是運行時的，頁面刷新後就丟了。所以上面代碼中用 `isDynamicRoutesAdded` 標誌來控製，刷新後會重新走一遍 `getUserInfo` + `addRoute` 流程。

但要注意：刷新時 Vue Router 會立即嘗試匹配當前 URL，此時動態路由還沒添加，會匹配到 `*` 通配路由（404）。解決方法是把 `*` 路由放在 `addRoute` 之後添加，並且在路由守衞中用 `next({ ...to, replace: true })` 重新觸發一次導航。

### 坑 4：beforeRouteLeave 中 this 指向

組件內守衞 `beforeRouteLeave` 中可以訪問 `this`，但如果用箭頭函數定義就會有問題：

```javascript
// 錯誤
beforeRouteLeave: (to, from, next) => {
  console.log(this.isModified) // this 不是組件實例！
}

// 正確
beforeRouteLeave(to, from, next) {
  console.log(this.isModified) // this 是組件實例
}
```

### 坑 5：beforeEach 中的異步操作

```javascript
// 常見問題：異步操作沒有正確處理
router.beforeEach((to, from, next) => {
  checkAuth().then(() => {
    next() // 異步回調中調用
  })
  // 沒有 return，函數同步執行完畢
})

// 建議寫法：用 async/await
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

## 小結

- 導航守衞的執行順序是：組件離開守衞 -> 全局 beforeEach -> 路由 beforeEnter -> 組件進入守衞 -> 全局 beforeResolve -> 全局 afterEach
- 權限控製的核心邏輯放在 `beforeEach` 中，配合 `meta` 字段聲明路由所需的權限
- 動態路由方案：登錄後根據角色調用 `router.addRoute`，刷新時需要重新執行
- `next()` 必須且隻能調用一次，用 `return next()` 避免多次調用
- 頁面離開確認用 `beforeRouteLeave`，結合數據修改狀態判斷
- 異步守衞優先用 `async/await`，避免回調地獄和時序問題
