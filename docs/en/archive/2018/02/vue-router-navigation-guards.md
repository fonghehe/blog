---
title: "Vue Router Navigation Guards: A Complete Guide"
date: 2018-02-01 16:46:07
tags:
  - Vue
readingTime: 3
description: "Vue Router's navigation guards are the core of permission control in projects, but the documentation is spread out and easy to get confused. This article walks "
---

Vue Router's navigation guards are the core of permission control in projects, but the documentation is spread out and easy to get confused. This article walks through all the guards with practical usage examples.

## Guard Categories

Vue Router guards fall into three categories by scope:

- **Global guards**: apply to all routes
- **Per-route guards**: defined in route config, apply only to that route
- **In-component guards**: defined inside a component, aware of that component's enter/leave events

## Global Guards

### beforeEach

The most-used guard — fires before every route transition:

```javascript
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");

  // Whitelist: pages that don't require login
  const whiteList = ["/login", "/register", "/about"];

  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  if (!token) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  next();
});
```

Note: **you must call `next()`** — forgetting to do so will freeze navigation. This is the most common mistake.

### afterEach

Fires after navigation completes; does not receive a `next` argument:

```javascript
router.afterEach((to, from) => {
  // Update page title
  document.title = to.meta.title || "My App";

  // Report page view
  analytics.trackPageView(to.path);
});
```

### beforeResolve

Fires after all in-component guards and async route components have resolved, before the navigation is confirmed. Used less often, but useful when you need to ensure components are fully loaded before taking action.

## Per-Route Guards

Written directly in the route config:

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminPanel,
    beforeEnter: (to, from, next) => {
      const user = store.getters.currentUser;
      if (!user || user.role !== "admin") {
        next("/403");
        return;
      }
      next();
    },
  },
];
```

This approach is good when a specific route has special permission logic and you don't want to pollute the global guard.

## In-Component Guards

### beforeRouteEnter

Fires before entering the component — **the component instance is not yet created**, so `this` is not available:

```javascript
export default {
  beforeRouteEnter(to, from, next) {
    // this is not available here
    // Get the instance via the next callback
    next((vm) => {
      vm.fetchData(to.params.id);
    });
  },
};
```

### beforeRouteUpdate

Fires when the route changes but the component is reused (e.g. `/user/1` → `/user/2`):

```javascript
export default {
  beforeRouteUpdate(to, from, next) {
    // this is available here
    this.userId = to.params.id;
    this.fetchData();
    next();
  },
};
```

Many people don't know about this guard, which causes data to not refresh when dynamic route params change.

### beforeRouteLeave

Fires before leaving the current route — commonly used to prevent users from accidentally leaving pages with unsaved changes:

```javascript
export default {
  data() {
    return { isDirty: false };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      const confirm = window.confirm("You have unsaved changes. Leave anyway?");
      if (!confirm) {
        next(false); // cancel navigation
        return;
      }
    }
    next();
  },
};
```

## Complete Navigation Resolution Flow

```
1. Navigation triggered
2. Call beforeRouteLeave in the leaving component
3. Call global beforeEach
4. Call per-route beforeEnter (if any)
5. Resolve async route components
6. Call beforeRouteEnter in the entering component
7. Call global beforeResolve
8. Navigation confirmed
9. Call global afterEach
10. DOM updates triggered
11. Call the next callback of beforeRouteEnter
```

Understanding this order makes it clear where to put permission logic.

## Permission Control Pattern in Real Projects

```javascript
// Annotate permissions in route meta
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
];

// Global guard handles all checks uniformly
router.beforeEach((to, from, next) => {
  if (!to.meta.requiresAuth) {
    next();
    return;
  }

  const user = store.getters.user;
  if (!user) {
    next("/login");
    return;
  }

  const requiredRoles = to.meta.roles;
  if (requiredRoles && !requiredRoles.includes(user.role)) {
    next("/403");
    return;
  }

  next();
});
```

This pattern keeps permission declarations in route config while the guard handles the unified check — easy to maintain.

## Summary

- `beforeEach` is the main battleground for permission checks
- `beforeRouteUpdate` fixes the issue of data not refreshing when dynamic route params change
- `beforeRouteLeave` prevents users from accidentally losing unsaved data
- Remember that `next()` must always be called — forgetting it will freeze the entire app
