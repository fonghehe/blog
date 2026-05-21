---
title: "Vue keep-alive Route Caching"
date: 2018-02-18 10:12:01
tags:
  - Vue
readingTime: 1
description: "There's a common requirement in admin dashboards: when navigating from a list page to a detail page and back, the list page should preserve its scroll position "
wordCount: 157
---

There's a common requirement in admin dashboards: when navigating from a list page to a detail page and back, the list page should preserve its scroll position and filter state. `keep-alive` solves exactly this.

## Basic Usage

```html
<!-- App.vue -->
<template>
  <div id="app">
    <keep-alive>
      <router-view />
    </keep-alive>
  </div>
</template>
```

With `keep-alive`, route components are cached instead of destroyed when switching routes, and are reused when navigated back to.

## Caching Only Specific Routes

In most cases, you don't want to cache all routes — only specific ones.

**Option 1: include/exclude**

```html
<!-- Only cache UserList and OrderList -->
<keep-alive :include="['UserList', 'OrderList']">
  <router-view />
</keep-alive>
```

```javascript
// Components need to set a name
export default {
  name: "UserList", // must match the name in include
};
```

**Option 2: Route meta config (recommended)**

```javascript
// router.js
const routes = [
  {
    path: "/users",
    component: UserList,
    meta: { keepAlive: true }, // cache this route
  },
  {
    path: "/users/:id",
    component: UserDetail,
    meta: { keepAlive: false }, // don't cache
  },
];
```

```html
<!-- App.vue -->
<keep-alive>
  <router-view v-if="$route.meta.keepAlive" />
</keep-alive>
<router-view v-if="!$route.meta.keepAlive" />
```

## activated and deactivated

Components cached by `keep-alive` have two additional lifecycle hooks:

```javascript
export default {
  name: "UserList",
  activated() {
    // Triggered each time the component is "activated" (including after first mount)
    // Good for: refreshing data when returning from a detail page
    console.log("UserList activated");
    this.refreshIfNeeded();
  },
  deactivated() {
    // Triggered when the component is "deactivated" (navigated away but not destroyed)
    console.log("UserList deactivated");
  },
};
```

Note: cached components do **not trigger** `created` and `mounted` on re-entry — only `activated` fires.

## Scroll Position Restoration in Real Projects

```javascript
export default {
  name: "UserList",
  data() {
    return {
      scrollTop: 0,
    };
  },
  activated() {
    // Restore scroll position
    this.$nextTick(() => {
      document.documentElement.scrollTop = this.scrollTop;
    });
  },
  deactivated() {
    // Save scroll position when leaving
    this.scrollTop = document.documentElement.scrollTop;
  },
};
```

## Summary

- `keep-alive` caches route components, avoiding repeated destroy-and-create cycles
- Use the `keepAlive` field in route meta to control which routes are cached
- Cached components use `activated`/`deactivated` instead of `mounted`/`beforeDestroy`
- Best for: preserving list page state on back navigation, tab switching without resetting
