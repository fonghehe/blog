---
title: "Vue Async Components and Dynamic Components"
date: 2018-05-08 10:58:42
tags:
  - Vue
readingTime: 2
description: "Lazy-loading components is a key technique for reducing the initial bundle size. Vue provides two mechanisms — async components and dynamic components — and it "
wordCount: 191
---

Lazy-loading components is a key technique for reducing the initial bundle size. Vue provides two mechanisms — async components and dynamic components — and it helps to understand the distinction and their usage.

## Async Components

Vue supports defining a component as a function that returns a Promise:

```javascript
// Method 1: simple factory function
const AsyncComponent = () => import("./HeavyComponent.vue");

// Method 2: advanced syntax with options (Vue 2.3+)
const AsyncComponent = () => ({
  component: import("./HeavyComponent.vue"), // component to load
  loading: LoadingSpinner, // shown while loading
  error: ErrorFallback, // shown on load failure
  delay: 200, // show loading after 200ms (avoids flash)
  timeout: 10000, // timeout
});
```

### Route-level Lazy Loading

The most common use case:

```javascript
const routes = [
  {
    path: "/dashboard",
    component: () => import("@/views/Dashboard.vue"),
  },
  {
    path: "/users",
    // webpackChunkName controls which chunk the file is grouped into
    component: () => import(/* webpackChunkName: "user" */ "@/views/Users.vue"),
  },
  {
    path: "/users/:id",
    component: () =>
      import(/* webpackChunkName: "user" */ "@/views/UserDetail.vue"),
  },
];
```

`user.[hash].js` is only downloaded when the user visits `/users` — it doesn't contribute to the initial bundle.

### Conditionally Rendering Async Components

```vue
<template>
  <div>
    <button @click="showEditor = true">Open Editor</button>

    <!-- The rich-text editor (usually large) is only loaded after clicking -->
    <RichTextEditor v-if="showEditor" content="..." />
  </div>
</template>

<script>
export default {
  components: {
    RichTextEditor: () => import("./RichTextEditor.vue"),
  },
  data() {
    return { showEditor: false };
  },
};
</script>
```

## Dynamic Components

Use `<component :is="xxx">` to switch components at runtime:

```vue
<template>
  <div>
    <button @click="current = 'TabA'">Tab A</button>
    <button @click="current = 'TabB'">Tab B</button>
    <button @click="current = 'TabC'">Tab C</button>

    <!-- is can be a component name string or a component object -->
    <component :is="current" />
  </div>
</template>

<script>
import TabA from "./TabA.vue";
import TabB from "./TabB.vue";
import TabC from "./TabC.vue";

export default {
  components: { TabA, TabB, TabC },
  data() {
    return { current: "TabA" };
  },
};
</script>
```

### Caching State with keep-alive

By default, switching components destroys the previous one and creates a new one. Use `<keep-alive>` to preserve component state:

```vue
<keep-alive>
  <component :is="current" />
</keep-alive>
```

Components wrapped in `<keep-alive>` do not trigger `created`/`destroyed`; instead they trigger:

- `activated`: component is activated (retrieved from cache)
- `deactivated`: component is deactivated (enters cache)

```javascript
export default {
  activated() {
    // Component is shown again — might need to refresh data
    this.refreshData();
  },
  deactivated() {
    // Component is cached — perform cleanup if needed
  },
};
```

### Combining Dynamic Components with Async Loading

The two patterns can be combined:

```javascript
const componentMap = {
  bar: () => import("./BarChart.vue"),
  line: () => import("./LineChart.vue"),
  pie: () => import("./PieChart.vue"),
};

export default {
  computed: {
    currentChart() {
      return componentMap[this.chartType];
    },
  },
};
```

## Summary

- Async components: load only when needed — ideal for large components and route-level lazy loading
- Dynamic components: switch components at runtime, useful for tabs and wizard steps
- `<keep-alive>`: cache state, avoid repeated initialization
- Combining dynamic + async: lazy-load only the specific component the user needs
