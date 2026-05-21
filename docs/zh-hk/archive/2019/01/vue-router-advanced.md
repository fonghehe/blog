---
title: "Vue Router 進階：導航守衞與權限控制"
date: 2019-01-20 16:47:45
tags:
  - Vue
readingTime: 2
description: "Vue Router 的基礎用法很簡單，但權限控制、路由元信息、動態添加路由這些進階用法，很多項目都沒用好。"
wordCount: 189
---

Vue Router 的基礎用法很簡單，但權限控制、路由元信息、動態添加路由這些進階用法，很多項目都沒用好。

## 導航守衞執行順序

```
beforeEach → beforeRouteUpdate → beforeEnter →
beforeRouteEnter → afterEach → beforeRouteEnter的next回調
```

```javascript
// 全局前置守衞
router.beforeEach((to, from, next) => {
  // to：即將進入的路由
  // from：當前路由
  // next()：放行，next(false)：中斷，next('/login')：重定向

  const isLoggedIn = store.getters["user/isLoggedIn"];

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ path: "/login", query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

// 全局後置鈎子（不影響導航）
router.afterEach((to, from) => {
  // 更新頁面標題
  document.title = to.meta.title || "默認標題";
});
```

## 路由元信息（meta）

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true, roles: ["admin", "superadmin"] },
    children: [
      {
        path: "users",
        component: UserList,
        meta: { requiresAuth: true, roles: ["admin"], title: "用户管理" },
      },
    ],
  },
];
```

## 角色權限控制

```javascript
router.beforeEach((to, from, next) => {
  const userRole = store.getters["user/role"];

  // matched 包含所有匹配的路由記錄（含嵌套父級）
  const requiredRoles = to.matched.flatMap((record) => record.meta.roles || []);

  if (requiredRoles.length === 0) {
    next();
    return;
  }

  if (!userRole || !requiredRoles.includes(userRole)) {
    next("/403");
    return;
  }

  next();
});
```

## 動態添加路由（後台權限菜單）

前端常見的需求：後端返回用户有權限的菜單，前端動態註冊路由。

```javascript
// 路由配置
const asyncRoutes = {
  "user-manage": {
    path: "/user-manage",
    component: () => import("@/views/UserManage"),
  },
  "order-list": {
    path: "/order-list",
    component: () => import("@/views/OrderList"),
  },
};

// 登錄後根據權限動態添加路由
async function setupAsyncRoutes(permissions) {
  const routes = permissions
    .filter((p) => asyncRoutes[p])
    .map((p) => asyncRoutes[p]);

  // Vue Router 3.x 方法
  routes.forEach((route) => router.addRoute(route));
}

// 登錄 action
async function login({ commit }, credentials) {
  const { user, token, permissions } = await api.login(credentials);
  commit("SET_USER", user);
  await setupAsyncRoutes(permissions);
  router.push("/dashboard");
}
```

## 路由懶加載 + 分組 Chunk

```javascript
// 按模塊分組，同一模塊的組件打包到同一 chunk
const routes = [
  {
    path: "/order",
    component: () =>
      import(/* webpackChunkName: "order" */ "@/views/OrderLayout"),
    children: [
      {
        path: "list",
        component: () =>
          import(/* webpackChunkName: "order" */ "@/views/OrderList"),
      },
      {
        path: "detail/:id",
        component: () =>
          import(/* webpackChunkName: "order" */ "@/views/OrderDetail"),
      },
    ],
  },
];
```

## 滾動行為

```javascript
const router = new VueRouter({
  scrollBehavior(to, from, savedPosition) {
    // 返回時恢復之前的滾動位置
    if (savedPosition) {
      return savedPosition;
    }
    // 有錨點時滾動到錨點
    if (to.hash) {
      return { selector: to.hash };
    }
    // 否則回到頂部
    return { x: 0, y: 0 };
  },
});
```

## 小結

- 全局守衞處理通用邏輯（登錄驗證、權限檢查）
- `route.matched` 獲取所有匹配記錄，適合處理嵌套路由權限
- `addRoute` 動態註冊路由實現後端驅動的權限菜單
- 路由懶加載 + `webpackChunkName` 控制代碼分割粒度
