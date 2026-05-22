---
title: "Vue 元件懶載入策略"
date: 2020-02-03 15:25:31
tags:
  - Vue
readingTime: 3
description: "首屏載入效能是前端最佳化的核心指標之一。Vue 專案的路由級懶載入已經很常見，但元件級懶載入、圖片懶載入、資料懶載入這些更細粒度的策略同樣值得深入掌握。本文從工程實踐出發，整理一套完整的懶載入方案。"
wordCount: 378
---

首屏載入效能是前端最佳化的核心指標之一。Vue 專案的路由級懶載入已經很常見，但元件級懶載入、圖片懶載入、資料懶載入這些更細粒度的策略同樣值得深入掌握。本文從工程實踐出發，整理一套完整的懶載入方案。

## 路由懶載入

最基礎也最有效的最佳化手段，將路由元件拆分到獨立 chunk。

```javascript
// router/index.js
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    // 直接匯入，首屏元件不懶載入
    component: () => import('../views/Home.vue')
  },
  {
    path: '/dashboard',
    // 非同步元件，按需載入
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

`webpackChunkName` 註釋讓打包產物有可讀的檔名，方便排查和快取管理。

## 元件級懶載入

不是所有元件都需要首屏載入。對於模態框、抽屜、編輯器這類"按需出現"的元件，可以用 `defineAsyncComponent` 實現懶載入。

```vue
<template>
  <div>
    <button @click="showEditor = true">開啟富文本編輯器</button>

    <AsyncEditor
      v-if="showEditor"
      v-model="content"
      @close="showEditor = false"
    />
  </div>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

// 僅在 v-if 為 true 時才載入元件程式碼
const AsyncEditor = defineAsyncComponent({
  loader: () => import('./components/HeavyEditor.vue'),
  loadingComponent: {
    template: '<div class="editor-loading">編輯器載入中...</div>'
  },
  errorComponent: {
    template: '<div class="editor-error">載入失敗，請重新整理重試</div>'
  },
  delay: 100,       // 延遲顯示 loading 元件的時間
  timeout: 15000,    // 超時時間
  suspensible: false // 不交給 Suspense 管理
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

## Intersection Observer 實現圖片懶載入

圖片是最常見的頻寬殺手。使用 `IntersectionObserver` API 實現可視區域內才載入真實圖片。

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
        rootMargin: '100px' // 提前 100px 開始載入
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

// 註冊與使用
// app.directive('lazy', vLazy)
// <img v-lazy="imageUrl" alt="產品圖" />
```

## 資料懶載入：虛擬滾動

列表資料量大時（超過 1000 條），即使隻渲染可見區域的 DOM 也能大幅提升效能。

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

## 小結

- 路由懶載入用 `() => import()` 配合 `webpackChunkName`，效果立竿見影
- `defineAsyncComponent` 支援自定義 loading/error 元件和超時配置
- 圖片懶載入使用 IntersectionObserver，設定 `rootMargin` 提前載入
- 大列表用虛擬滾動，隻渲染可視區域內的 DOM，效能提升可達數十倍
- 懶載入的核心原則：不在首屏的程式碼和資源，一律按需載入
