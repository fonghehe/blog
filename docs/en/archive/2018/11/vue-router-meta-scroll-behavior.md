---
title: "Vue Router Navigation Guards in Practice"
date: 2018-11-24 11:06:12
tags:
  - Vue
readingTime: 2
description: "As projects grow, route permission control becomes complex: some pages require login, some are admin-only, some need a \"confirm before leaving\" prompt when ther"
---

As projects grow, route permission control becomes complex: some pages require login, some are admin-only, some need a "confirm before leaving" prompt when there are unsaved changes. Navigation guards handle all of this in one place.

## Global Before Guard

```javascript
// router/index.js
import router from "./config";
import store from "@/store";

const WHITE_LIST = ["/login", "/register", "/forgot-password"];

router.beforeEach(async (to, from, next) => {
  const token = store.getters.token;

  if (WHITE_LIST.includes(to.path)) {
    // Whitelisted page — allow through
    next();
    return;
  }

  if (!token) {
    // Not logged in — redirect to login page, recording the source path (to redirect back after login)
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  // Logged in but no user info yet (first visit or page refresh)
  if (!store.getters.userInfo) {
    try {
      await store.dispatch("user/getUserInfo");
      // Re-navigate (because permission info was just loaded)
      next({ ...to, replace: true });
    } catch (e) {
      // Failed to fetch user info (token may have expired)
      await store.dispatch("user/logout");
      next("/login");
    }
    return;
  }

  next();
});
```

## Meta-based Permission Control

```javascript
// router/routes.js
const routes = [
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: "/admin",
    component: AdminPanel,
    meta: { requiresAuth: true, roles: ["admin"] },
  },
  {
    path: "/settings",
    component: Settings,
    meta: { requiresAuth: true, roles: ["admin", "editor"] },
  },
];
```

```javascript
// Check permissions in beforeEach
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !store.getters.isLoggedIn) {
    next("/login");
    return;
  }

  if (to.meta.roles) {
    const userRole = store.getters.userRole;
    if (!to.meta.roles.includes(userRole)) {
      next("/403"); // no permission page
      return;
    }
  }

  next();
});
```

## Component Guard: Confirm Before Leaving a Form

```javascript
export default {
  data() {
    return {
      isDirty: false, // whether the form has unsaved changes
    };
  },
  beforeRouteLeave(to, from, next) {
    if (this.isDirty) {
      this.$confirm("You have unsaved changes. Leave anyway?", "Warning", {
        confirmButtonText: "Leave",
        cancelButtonText: "Stay",
        type: "warning",
      })
        .then(() => {
          next(); // confirmed — leave
        })
        .catch(() => {
          next(false); // cancelled — stay on current page
        });
    } else {
      next();
    }
  },
};
```

## Route-specific Guard

```javascript
const routes = [
  {
    path: "/pay/:orderId",
    component: PayPage,
    // Guard only for this route
    beforeEnter(to, from, next) {
      const orderId = to.params.orderId;
      if (!orderId || !isValidOrderId(orderId)) {
        next("/404");
        return;
      }
      next();
    },
  },
];
```

## Global After Hook

```javascript
// Runs after navigation completes (cannot call next)
router.afterEach((to, from) => {
  // Update page title
  document.title = to.meta.title || "Admin System";

  // Report page view
  analytics.track("pageview", { path: to.path });

  // Close global loading indicator
  NProgress.done();
});
```

## Redirect Back to Source Page After Login

```javascript
// After successful login
const redirect = this.$route.query.redirect || "/dashboard";
this.$router.push(redirect);
```

## Summary

- `beforeEach`: global before — handle login checks and permission control
- `afterEach`: global after — update page title, report PV
- `beforeRouteLeave`: component-level — handle form leave confirmation
- `beforeEnter`: route-level — handle entry logic for specific routes
- Use `meta` fields to declare route permission requirements; handle them centrally in the guard
