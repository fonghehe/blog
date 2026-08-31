---
title: "Vue Component Lazy Loading Strategies"
date: 2020-02-03 15:25:31
tags:
  - Vue
readingTime: 3
description: "First-screen load performance is a core metric in frontend optimization. Route-level lazy loading is already common in Vue projects, but finer-grained strategies—component-level, image, and data lazy loading—are equally worth mastering. This article lays out a complete lazy-loading playbook drawn from engineering practice."
wordCount: 247
---

First-screen load performance is one of the core metrics in front-end optimization. Route-level lazy loading is already common in Vue projects, but finer-grained strategies — component-level lazy loading, image lazy loading, and data lazy loading — are just as worth mastering. Drawing on engineering practice, this article lays out a complete lazy-loading playbook.

## Route Lazy Loading

The most basic yet most effective optimization: split route components into separate chunks.

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    // 直接导入，首屏组件不懒加载
    component: () => import('../views/Home.vue')
  },
  {
    path: '/dashboard',
    // 异步组件，按需加载
    component: () => import(
      /* webpackChunkName: "dashboard" */
      '../views/Dashboard.vue'
    )
  },
  {
    path: '/settings',
    component: () => import(
      /* webpackChunkName: "settings" */
      '../views/Settings.vue'
    )
  },
  {
    path: '/profile/:id',
    component: () => import(
      /* webpackChunkName: "profile" */
      '../views/Profile.vue'
    )
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

The `webpackChunkName` comment gives the bundled output a readable filename, which makes debugging and cache management easier.

## Component-Level Lazy Loading

Not every component needs to load on the first screen. For components that appear on demand — modals, drawers, editors — you can lazy-load them with `defineAsyncComponent`.

```vue
<template>
  <div>
    <button @click="showEditor = true">打开富文本编辑器</button>

    <AsyncEditor
      v-if="showEditor"
      v-model="content"
      @close="showEditor = false"
    />
  </div>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

// 仅在 v-if 为 true 时才加载组件代码
const AsyncEditor = defineAsyncComponent({
  loader: () => import('./components/HeavyEditor.vue'),
  loadingComponent: {
    template: '<div class="editor-loading">编辑器加载中...</div>'
  },
  errorComponent: {
    template: '<div class="editor-error">加载失败，请刷新重试</div>'
  },
  delay: 100,       // 延迟显示 loading 组件的时间
  timeout: 15000,    // 超时时间
  suspensible: false // 不交给 Suspense 管理
})

export default {
  components: { AsyncEditor },
  setup() {
    const showEditor = ref(false)
    const content = ref('')
    return { showEditor, content }
  }
}
</script>
```

## Lazy-Loading Images with Intersection Observer

Images are the most common bandwidth hog. Use the `IntersectionObserver` API to load the real image only when it enters the viewport.

```javascript
// directives/v-lazy.js
export default {
  mounted(el, binding) {
    const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

    el.src = placeholder
    el.dataset.src = binding.value

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target
            img.src = img.dataset.src
            img.onload = () => {
              img.classList.add('loaded')
            }
            img.onerror = () => {
              img.src = binding.value.fallback || placeholder
            }
            observer.unobserve(img)
          }
        })
      },
      {
        rootMargin: '100px' // 提前 100px 开始加载
      }
    )

    observer.observe(el)
    el._lazyObserver = observer
  },

  unmounted(el) {
    if (el._lazyObserver) {
      el._lazyObserver.disconnect()
    }
  }
}

// 注册与使用
// app.directive('lazy', vLazy)
// <img v-lazy="imageUrl" alt="产品图" />
```

## Data Lazy Loading: Virtual Scrolling

When a list is large (over 1,000 rows), rendering only the DOM in the visible area can dramatically improve performance.

```vue
{% raw %}
<template>
  <div
    ref="container"
    class="virtual-list"
    @scroll="onScroll"
  >
    <div class="phantom" :style="{ height: totalHeight + 'px' }"></div>
    <div
      class="content"
      :style="{ transform: `translateY(${offset}px)` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.id"
        class="list-item"
        :style="{ height: itemHeight + 'px' }"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  props: {
    items: { type: Array, default: () => [] },
    itemHeight: { type: Number, default: 50 }
  },
  setup(props) {
    const container = ref(null)
    const scrollTop = ref(0)
    const visibleCount = ref(10)

    const totalHeight = computed(() => props.items.length * props.itemHeight)
    const startIndex = computed(() => Math.floor(scrollTop.value / props.itemHeight))
    const endIndex = computed(() => Math.min(startIndex.value + visibleCount.value, props.items.length))

    const visibleItems = computed(() =>
      props.items.slice(startIndex.value, endIndex.value)
    )

    const offset = computed(() => startIndex.value * props.itemHeight)

    const onScroll = (e) => {
      scrollTop.value = e.target.scrollTop
    }

    onMounted(() => {
      visibleCount.value = Math.ceil(
        container.value.clientHeight / props.itemHeight
      ) + 2
    })

    return { container, totalHeight, visibleItems, offset, onScroll }
  }
}
</script>
{% endraw %}
```

## Summary

- Route-level lazy loading with `() => import()` plus `webpackChunkName` pays off immediately
- `defineAsyncComponent` supports custom loading/error components and a timeout setting
- For image lazy loading, use IntersectionObserver and set `rootMargin` to start loading ahead of time
- For large lists, use virtual scrolling and render only the DOM in the visible area — a performance gain of up to tens of times
- The core principle of lazy loading: anything not needed on the first screen should be loaded on demand
