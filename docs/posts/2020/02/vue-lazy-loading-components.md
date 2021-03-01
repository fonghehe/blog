---
title: "Vue 组件懒加载策略"
date: 2020-02-03 15:25:31
tags:
  - Vue
---

首屏加载性能是前端优化的核心指标之一。Vue 项目的路由级懒加载已经很常见，但组件级懒加载、图片懒加载、数据懒加载这些更细粒度的策略同样值得深入掌握。本文从工程实践出发，整理一套完整的懒加载方案。

## 路由懒加载

最基础也最有效的优化手段，将路由组件拆分到独立 chunk。

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

`webpackChunkName` 注释让打包产物有可读的文件名，方便排查和缓存管理。

## 组件级懒加载

不是所有组件都需要首屏加载。对于模态框、抽屉、编辑器这类"按需出现"的组件，可以用 `defineAsyncComponent` 实现懒加载。

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

## Intersection Observer 实现图片懒加载

图片是最常见的带宽杀手。使用 `IntersectionObserver` API 实现可视区域内才加载真实图片。

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

## 数据懒加载：虚拟滚动

列表数据量大时（超过 1000 条），即使只渲染可见区域的 DOM 也能大幅提升性能。

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

## 小结

- 路由懒加载用 `() => import()` 配合 `webpackChunkName`，效果立竿见影
- `defineAsyncComponent` 支持自定义 loading/error 组件和超时配置
- 图片懒加载使用 IntersectionObserver，设置 `rootMargin` 提前加载
- 大列表用虚拟滚动，只渲染可视区域内的 DOM，性能提升可达数十倍
- 懒加载的核心原则：不在首屏的代码和资源，一律按需加载
