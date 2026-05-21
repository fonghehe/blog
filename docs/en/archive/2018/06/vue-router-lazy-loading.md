---
title: "Vue Router Lazy Loading and Performance Optimization"
date: 2018-06-30 09:32:13
tags:
  - Vue
readingTime: 1
description: "Our back-office admin app kept growing and the homepage load time kept increasing. Using Vue Router's lazy loading to split the initial bundle made a noticeable"
wordCount: 143
---

Our back-office admin app kept growing and the homepage load time kept increasing. Using Vue Router's lazy loading to split the initial bundle made a noticeable difference in speed.

## What Is Route Lazy Loading

```javascript
// Without lazy loading: all pages bundled into one bundle
import Home from "./views/Home.vue";
import User from "./views/User.vue";
import Order from "./views/Order.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/user", component: User },
  { path: "/order", component: Order },
];

// Problem: visiting the homepage also downloads the User and Order code
```

```javascript
// Lazy loading: only download a page's code when that route is accessed
const routes = [
  {
    path: "/",
    component: () => import("./views/Home.vue"),
  },
  {
    path: "/user",
    component: () => import("./views/User.vue"),
  },
  {
    path: "/order",
    component: () => import("./views/Order.vue"),
  },
];
```

## Group Bundling (Magic Comments)

By default, each lazy-loaded route generates a separate chunk. You can use magic comments to bundle related pages together:

```javascript
const routes = [
  // User module: bundled into the same chunk
  {
    path: "/user/list",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserList.vue"),
  },
  {
    path: "/user/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "./views/UserDetail.vue"),
  },

  // Order module
  {
    path: "/order/list",
    component: () =>
      import(/* webpackChunkName: "order" */ "./views/OrderList.vue"),
  },
];
```

Result:

```
dist/
├── app.js          ← main bundle
├── chunk-user.js   ← user module
└── chunk-order.js  ← order module
```

## Real-World Results

Actual numbers from our project:

```
Before: app.js 1.2MB (380KB gzipped)
After:
  app.js: 340KB (110KB gzipped)
  Feature module chunks: 50–150KB each

First-screen load: 4.2s → 1.8s
```

## Route-Level Loading State

Lazy loading introduces a brief loading time. Handle it with a loading component:

```javascript
// Create Loading and Error components
const LoadingComponent = {
  template: '<div class="loading">Loading...</div>',
};
const ErrorComponent = {
  template: '<div class="error">Load failed</div>',
};

// Lazy load with loading state
function lazyLoad(componentFn) {
  return () => ({
    component: componentFn(),
    loading: LoadingComponent,
    error: ErrorComponent,
    delay: 200, // show loading only after 200ms (avoids flash on fast networks)
    timeout: 10000, // 10s timeout
  });
}

const routes = [
  {
    path: "/dashboard",
    component: lazyLoad(() => import("./views/Dashboard.vue")),
  },
];
```

## Prefetch

Download code before the user navigates:

```javascript
// webpackPrefetch: download during browser idle time (recommended)
() => import(/* webpackPrefetch: true */ './views/UserDetail.vue')

// webpackPreload: download in parallel with the current chunk (for high-probability navigations)
() => import(/* webpackPreload: true */ './views/Dashboard.vue')
```

In back-office admin apps, prefetching major feature modules after login is a good practice.

## Summary

- Route lazy loading: `component: () => import('./Page.vue')`
- Magic comment `webpackChunkName`: bundle related pages into the same chunk
- First-screen optimization: only load the JS you currently need; load the rest on demand
- `webpackPrefetch`: preload during browser idle time for even better UX
