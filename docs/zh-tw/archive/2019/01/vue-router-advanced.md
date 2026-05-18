---
title: "Vue Router 進階：導航守衛與許可權控制"
date: 2019-01-20 16:47:45
tags:
  - Vue
readingTime: 2
description: "Vue Router 的基礎用法很簡單，但許可權控制、路由元資訊、動態新增路由這些進階用法，很多專案都沒用好。"
---

Vue Router 的基礎用法很簡單，但許可權控制、路由元資訊、動態新增路由這些進階用法，很多專案都沒用好。

## 導航守衛執行順序

```
beforeEach → beforeRouteUpdate → beforeEnter →
beforeRouteEnter → afterEach → beforeRouteEnter的next回撥
```

```javascript
// 全域性前置守衛
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

// 全域性後置鉤子（不影響導航）
router.afterEach((to, from) => {
  // 更新頁面標題
  document.title = to.meta.title || "預設標題";
});
```

## 路由元資訊（meta）

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
        meta: { requiresAuth: true, roles: ["admin"], title: "使用者管理" },
      },
    ],
  },
];
```

## 角色許可權控制

```javascript
router.beforeEach((to, from, next) => {
  const userRole = store.getters["user/role"];

  // matched 包含所有匹配的路由記錄（含巢狀父級）
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

## 動態新增路由（後臺許可權選單）

前端常見的需求：後端返回使用者有許可權的選單，前端動態註冊路由。

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

// 登入後根據許可權動態新增路由
async function setupAsyncRoutes(permissions) {
  const routes = permissions
    .filter((p) => asyncRoutes[p])
    .map((p) => asyncRoutes[p]);

  // Vue Router 3.x 方法
  routes.forEach((route) => router.addRoute(route));
}

// 登入 action
async function login({ commit }, credentials) {
  const { user, token, permissions } = await api.login(credentials);
  commit("SET_USER", user);
  await setupAsyncRoutes(permissions);
  router.push("/dashboard");
}
```

## 路由懶載入 + 分組 Chunk

```javascript
// 按模組分組，同一模組的元件打包到同一 chunk
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

- 全域性守衛處理通用邏輯（登入驗證、許可權檢查）
- `route.matched` 獲取所有匹配記錄，適合處理巢狀路由許可權
- `addRoute` 動態註冊路由實現後端驅動的許可權選單
- 路由懶載入 + `webpackChunkName` 控制程式碼分割粒度
