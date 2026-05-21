---
title: "Vue 2 Async Component Loading"
date: 2019-07-02 17:09:18
tags:
  - Vue
readingTime: 2
description: "As applications grow, shipping all components in a single bundle becomes a performance bottleneck. Vue 2's async component feature lets you split component defi"
wordCount: 160
---

As applications grow, shipping all components in a single bundle becomes a performance bottleneck. Vue 2's async component feature lets you split component definitions into separate chunks and load them only when needed.

## Basic Async Component

The simplest form: return a Promise that resolves to a component definition:

```javascript
// In router or parent component
const AsyncDashboard = () => import("./views/Dashboard.vue");

// Vue resolves this lazily when Dashboard needs to render
const router = new VueRouter({
  routes: [{ path: "/dashboard", component: AsyncDashboard }],
});
```

## Advanced Factory Function with Loading/Error States

Vue 2 supports an advanced factory function that controls loading and error UI:

```javascript
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"),
  loading: LoadingSpinner, // Shown while loading
  error: ErrorDisplay, // Shown if loading fails
  delay: 200, // Wait 200ms before showing loading
  timeout: 10000, // Error after 10 seconds
});
```

## Vue.component for Global Registration

```javascript
// Register globally
Vue.component("async-chart", () => import("./components/Chart.vue"));

// With loading state
Vue.component("async-chart", () => ({
  component: import("./components/Chart.vue"),
  loading: {
    template: '<div class="skeleton chart-skeleton"></div>',
  },
  error: {
    template: '<div class="error">Failed to load chart</div>',
  },
  delay: 300,
  timeout: 8000,
}));
```

## Route-Level Code Splitting with Webpack

Name chunks for better debugging:

```javascript
const routes = [
  {
    path: "/",
    component: () => import(/* webpackChunkName: "home" */ "./views/Home.vue"),
  },
  {
    path: "/profile",
    component: () =>
      import(/* webpackChunkName: "profile" */ "./views/Profile.vue"),
  },
  // Group related pages into one chunk
  {
    path: "/admin",
    component: () =>
      import(/* webpackChunkName: "admin" */ "./views/Admin.vue"),
  },
  {
    path: "/admin/users",
    component: () =>
      import(/* webpackChunkName: "admin" */ "./views/AdminUsers.vue"),
  },
];
```

## Practical Pattern: Conditional Loading

Only load heavy components when the user needs them:

```vue
<template>
  <div>
    <button @click="showChart = true">Show Chart</button>

    <template v-if="showChart">
      <!-- Chart component loaded on demand -->
      <async-chart :data="chartData" />
    </template>
  </div>
</template>

<script>
export default {
  components: {
    AsyncChart: () => ({
      component: import("./components/HeavyChart.vue"),
      loading: { template: '<div class="loading">Loading chart...</div>' },
      delay: 100,
    }),
  },
  data() {
    return {
      showChart: false,
      chartData: [],
    };
  },
};
</script>
```

## Prefetch and Preload

Hint to the browser to load chunks early:

```javascript
// Prefetch: low priority, loaded during idle time
() => import(/* webpackPrefetch: true */ './views/Settings.vue')

// Preload: high priority, loaded alongside current chunk
() => import(/* webpackPreload: true */ './utils/heavyLib.js')
```

Prefetch is generally preferred for routes the user might visit next, while preload is for resources definitely needed soon.

## Summary

- Async components enable code splitting at the component level
- Use the advanced factory function for loading/error states and timeout control
- `webpackChunkName` groups related components into one chunk
- Prefetch hints improve perceived performance for subsequent navigation
