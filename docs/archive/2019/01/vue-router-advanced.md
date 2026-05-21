---
title: "Vue Router 进阶：导航守卫与权限控制"
date: 2019-01-20 16:47:45
tags:
  - Vue
readingTime: 2
description: "Vue Router 的基础用法很简单，但权限控制、路由元信息、动态添加路由这些进阶用法，很多项目都没用好。"
wordCount: 189
---

Vue Router 的基础用法很简单，但权限控制、路由元信息、动态添加路由这些进阶用法，很多项目都没用好。

## 导航守卫执行顺序

```
beforeEach → beforeRouteUpdate → beforeEnter →
beforeRouteEnter → afterEach → beforeRouteEnter的next回调
```

```javascript
// 全局前置守卫
router.beforeEach((to, from, next) => {
  // to：即将进入的路由
  // from：当前路由
  // next()：放行，next(false)：中断，next('/login')：重定向

  const isLoggedIn = store.getters["user/isLoggedIn"];

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ path: "/login", query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

// 全局后置钩子（不影响导航）
router.afterEach((to, from) => {
  // 更新页面标题
  document.title = to.meta.title || "默认标题";
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

## 角色权限控制

```javascript
router.beforeEach((to, from, next) => {
  const userRole = store.getters["user/role"];

  // matched 包含所有匹配的路由记录（含嵌套父级）
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

## 动态添加路由（后台权限菜单）

前端常见的需求：后端返回用户有权限的菜单，前端动态注册路由。

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

// 登录后根据权限动态添加路由
async function setupAsyncRoutes(permissions) {
  const routes = permissions
    .filter((p) => asyncRoutes[p])
    .map((p) => asyncRoutes[p]);

  // Vue Router 3.x 方法
  routes.forEach((route) => router.addRoute(route));
}

// 登录 action
async function login({ commit }, credentials) {
  const { user, token, permissions } = await api.login(credentials);
  commit("SET_USER", user);
  await setupAsyncRoutes(permissions);
  router.push("/dashboard");
}
```

## 路由懒加载 + 分组 Chunk

```javascript
// 按模块分组，同一模块的组件打包到同一 chunk
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

## 滚动行为

```javascript
const router = new VueRouter({
  scrollBehavior(to, from, savedPosition) {
    // 返回时恢复之前的滚动位置
    if (savedPosition) {
      return savedPosition;
    }
    // 有锚点时滚动到锚点
    if (to.hash) {
      return { selector: to.hash };
    }
    // 否则回到顶部
    return { x: 0, y: 0 };
  },
});
```

## 小结

- 全局守卫处理通用逻辑（登录验证、权限检查）
- `route.matched` 获取所有匹配记录，适合处理嵌套路由权限
- `addRoute` 动态注册路由实现后端驱动的权限菜单
- 路由懒加载 + `webpackChunkName` 控制代码分割粒度
