---
title: "Vue Router Navigation Guards: Complete Guide"
date: 2019-07-03 10:02:55
tags:
  - Vue
readingTime: 2
description: "Navigation guards are Vue Router's mechanism for controlling access to routes. They can be used for authentication checks, permission verification, data pre-fet"
wordCount: 185
---

Navigation guards are Vue Router's mechanism for controlling access to routes. They can be used for authentication checks, permission verification, data pre-fetching, and more. This article covers all navigation guard types and their execution order.

## Types of Navigation Guards

Vue Router provides three types of navigation guards:

1. **Global guards** — applied to all routes
2. **Per-route guards** — defined on specific route configurations
3. **In-component guards** — defined inside component options

## Global Guards

### beforeEach

The most commonly used global guard, runs before every navigation:

```javascript
import router from "./router";
import store from "./store";

router.beforeEach((to, from, next) => {
  // to: target Route object
  // from: current Route object
  // next: function to resolve the hook

  const isAuthenticated = store.getters.isAuthenticated;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: "Login", query: { redirect: to.fullPath } });
  } else {
    next(); // Must call next() to proceed
  }
});
```

### beforeResolve

Runs after all in-component guards and async route components resolve, but before navigation is confirmed:

```javascript
router.beforeResolve((to, from, next) => {
  // Good for data fetching that depends on async components resolving first
  if (to.meta.fetchData) {
    store.dispatch("fetchPageData", to.params).then(() => next());
  } else {
    next();
  }
});
```

### afterEach

Runs after navigation is confirmed. No `next` function since navigation is already complete:

```javascript
router.afterEach((to, from) => {
  // Analytics tracking
  window.analytics?.track("Page View", {
    page: to.name,
    path: to.fullPath,
  });

  // Update document title
  document.title = to.meta.title || "My App";
});
```

## Per-Route Guards

Defined in the route configuration:

```javascript
const routes = [
  {
    path: "/admin",
    component: AdminLayout,
    beforeEnter: (to, from, next) => {
      const user = store.getters.currentUser;
      if (!user || !user.roles.includes("admin")) {
        next({ name: "Forbidden" });
      } else {
        next();
      }
    },
    children: [
      // These inherit the parent's beforeEnter guard
      { path: "users", component: AdminUsers },
      { path: "settings", component: AdminSettings },
    ],
  },
];
```

## In-Component Guards

Defined as component options:

```javascript
export default {
  name: "UserProfile",

  beforeRouteEnter(to, from, next) {
    // Called before the component is created
    // 'this' is NOT available here
    next((vm) => {
      // Access the component instance via vm
      vm.fetchUser(to.params.id);
    });
  },

  beforeRouteUpdate(to, from, next) {
    // Called when the route changes but the component is reused
    // e.g., /user/1 -> /user/2
    // 'this' is available
    this.fetchUser(to.params.id);
    next();
  },

  beforeRouteLeave(to, from, next) {
    // Called before navigating away from the current component
    if (this.hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Leave anyway?",
      );
      if (confirmed) {
        next();
      } else {
        next(false); // Cancel the navigation
      }
    } else {
      next();
    }
  },
};
```

## Execution Order

The complete navigation lifecycle:

```
1. Navigation triggered
2. beforeRouteLeave (leaving component)
3. beforeEach (global)
4. beforeRouteUpdate (reused components)
5. beforeEnter (route config)
6. Resolve async route components
7. beforeRouteEnter (entering component)
8. beforeResolve (global)
9. Navigation confirmed
10. afterEach (global)
11. DOM updates
12. beforeRouteEnter next() callbacks
```

## Complete Auth Flow Example

```javascript
// router/index.js
const router = new VueRouter({
  routes: [
    { path: "/", component: Home },
    { path: "/login", component: Login, meta: { guestOnly: true } },
    {
      path: "/dashboard",
      component: Dashboard,
      meta: { requiresAuth: true },
    },
    {
      path: "/admin",
      component: AdminLayout,
      meta: { requiresAuth: true, roles: ["admin", "superadmin"] },
      children: [{ path: "users", component: AdminUsers }],
    },
  ],
});

// Auth guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem("token");
  const user = store.getters.currentUser;

  // Redirect logged-in users away from login page
  if (to.meta.guestOnly && token) {
    return next({ path: "/" });
  }

  // Require authentication
  if (to.meta.requiresAuth) {
    if (!token) {
      return next({ path: "/login", query: { redirect: to.fullPath } });
    }

    // Role-based access
    if (to.meta.roles && !to.meta.roles.some((r) => user.roles.includes(r))) {
      return next({ path: "/403" });
    }
  }

  next();
});
```

## Summary

- **Global guards**: `beforeEach`, `beforeResolve`, `afterEach` — applied to all routes
- **Per-route guards**: `beforeEnter` — for route-specific access control
- **In-component guards**: `beforeRouteEnter`, `beforeRouteUpdate`, `beforeRouteLeave`
- Always call `next()` to avoid hanging navigation
- `beforeRouteEnter` runs before the component is created — use `next(vm => ...)` to access the instance
