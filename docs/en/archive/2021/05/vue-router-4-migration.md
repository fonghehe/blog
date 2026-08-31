---
title: "Vue Router 4 Migration: From v3 to v4"
date: 2021-05-03 09:31:43
tags:
  - Vue

readingTime: 2
description: "The Vue 3 ecosystem matured through 2021, and Vue Router 4 entered its stable phase with it. Early this year I led the Vue Router 3 to 4 migration of a mid-sized admin system, hit plenty of pitfalls, and here is a summary of the core changes and migration strategy."
wordCount: 274
---

The Vue 3 ecosystem matured steadily through 2021, and Vue Router 4 reached stability alongside it. Early this year I led the migration of a medium-sized admin system from Vue Router 3 to 4, hit quite a few pitfalls, and here's a summary of the key changes and migration strategy.

## Changes to Route Definition

The most visible change in Vue Router 4 is that the API for creating an instance went from a constructor to a function call:

```javascript
// Vue Router 3
import Vue from 'vue'
import VueRouter from 'vue-router'
Vue.use(VueRouter)
const router = new VueRouter({
  routes: [...]
})

// Vue Router 4
import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(),
  routes: [...]
})
```

Note that `mode: 'history'` was replaced by the `history` option, and you must explicitly call `createWebHistory()`, `createWebHashHistory()`, or `createMemoryHistory()`.

## Route Guard Adjustments

The composition-API equivalents of `beforeRouteEnter`, `beforeRouteUpdate`, and `beforeRouteLeave` have changed:

```javascript
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

export default {
  setup() {
    // 替代 beforeRouteLeave
    onBeforeRouteLeave((to, from) => {
      if (hasUnsavedChanges()) {
        return window.confirm('确定离开？未保存的数据将丢失')
      }
    })

    // 替代 beforeRouteUpdate
    onBeforeRouteUpdate((to, from) => {
      if (to.params.id !== from.params.id) {
        fetchUserData(to.params.id)
      }
    })
  }
}
```

## Common Pitfalls

**1. The `*` wildcard route is no longer supported**

Vue Router 4 removed the `*` wildcard in favor of `/:pathMatch(.*)*`:

```javascript
// Vue Router 3
{ path: '*', component: NotFound }

// Vue Router 4
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
// 或者多级嵌套：
{ path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound }
```

**2. The `$router` and `$route` types changed**

In TypeScript projects, you should use `useRouter()` and `useRoute()` to get type-safe instances:

```typescript
import { useRouter, useRoute } from 'vue-router'

export default {
  setup() {
    const router = useRouter()
    const route = useRoute()

    // route.params 有正确的类型推断
    console.log(route.params.id) // string | string[]
  }
}
```

**3. `router.match` was removed**

Use `router.resolve()` instead:

```javascript
// Vue Router 3
const route = router.match('/path')

// Vue Router 4
const resolved = router.resolve('/path')
```

## Migration Strategy

We went with an incremental migration:

1. First upgrade the Vue Router package without touching business code, leaning on the compatibility layer to get things running
2. Replace the APIs file by file, prioritizing route definitions and guards
3. Finally, tackle the TypeScript type issues in one pass
4. Test dynamic and nested route scenarios thoroughly

The whole migration took about two weeks, most of it spent on type fixes and edge-case testing.

## Summary

- Vue Router 4's API is more functional and aligns with Vue 3's composition-API style
- The wildcard-route and route-guard changes are the main breaking changes
- TypeScript support is greatly improved; `useRouter`/`useRoute` is the recommended approach
- An incremental migration strategy effectively lowers risk