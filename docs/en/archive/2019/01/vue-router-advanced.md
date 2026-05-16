---
title: "Advanced Vue Router: Navigation Guards and Permission Control"
date: 2019-01-20 16:47:45
tags:
  - Vue
readingTime: 1
description: "The basics of Vue Router are simple enough, but advanced features like permission control, route meta information, and dynamically adding routes are often under"
---

The basics of Vue Router are simple enough, but advanced features like permission control, route meta information, and dynamically adding routes are often underutilized in real projects.

## Navigation Guard Execution Order

```
beforeEach → beforeRouteUpdate → beforeEnter →
beforeRouteEnter → afterEach → beforeRouteEnter's next callback
```

```javascript
// Global before guard
router.beforeEach((to, from, next) => {
  // to: the route being navigated to
  // from: the current route
  // next(): proceed, next(false): abort, next('/login'): redirect

  const isLoggedIn = store.getters["user/isLoggedIn"];

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ path: "/login", query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

// Global after hook (does not affect navigation)
router.afterEach((to, from) => {
  // Update the page title
  document.title = to.meta.title || "Default Title";
});
```

## Route Meta Information

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
        meta: {
          requiresAuth: true,
          roles: ["admin"],
          title: "User Management",
        },
      },
    ],
  },
];
```

## Role-Based Permission Control

```javascript
router.beforeEach((to, from, next) => {
  const userRole = store.getters["user/role"];

  // matched contains all matched route records (including nested parents)
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

## Dynamically Adding Routes (Backend Permission Menus)

A common frontend requirement: the backend returns the menus the user has permission for, and the frontend dynamically registers routes.

```javascript
// Route configuration
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

// Dynamically add routes after login based on permissions
async function setupAsyncRoutes(permissions) {
  const routes = permissions
    .filter((p) => asyncRoutes[p])
    .map((p) => asyncRoutes[p]);

  // Vue Router 3.x method
  routes.forEach((route) => router.addRoute(route));
}

// Login action
async function login({ commit }, credentials) {
  const { user, token, permissions } = await api.login(credentials);
  commit("SET_USER", user);
  await setupAsyncRoutes(permissions);
  router.push("/dashboard");
}
```

## Lazy Loading Routes + Chunk Grouping

```javascript

```
