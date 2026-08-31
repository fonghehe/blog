---
title: "Vue 3 New Features: Teleport, Fragment, and Suspense"
date: 2020-01-10 15:48:35
tags:
  - Vue
readingTime: 2
description: "Vue 3 introduced three useful built-in components: Teleport renders children anywhere in the DOM tree, Fragment supports multi-root templates, and Suspense handles async component loading states. These features resolve long-standing pain points from Vue 2."
wordCount: 282
---

Vue 3 introduced three handy built-in components: Teleport renders child nodes to any position in the DOM tree, Fragment supports multi-root-node templates, and Suspense handles the loading state of async components. These three features resolve long-standing pain points in Vue 2.

## Teleport: Breaking Out of the Component Tree

Components like modals, tooltips, and full-screen loading are often clipped by a parent's `overflow: hidden` or `z-index`. Teleport can move the DOM to a specified location while keeping the component's logical ownership intact.

```vue
<template>
  <div>
    <button @click="showModal = true">打开弹窗</button>
    <!-- 渲染到 body 末尾，不受父组件 CSS 影响 -->
    <teleport to="body">
      <div v-if="showModal" class="modal-overlay">
        <div class="modal-content">
          <h3>确认操作</h3>
          <p>确定要删除这条记录吗？</p>
          <button @click="confirmDelete">确定</button>
          <button @click="showModal = false">取消</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  setup() {
    const showModal = ref(false)
    const confirmDelete = () => {
      console.log('已删除')
      showModal.value = false
    }
    return { showModal, confirmDelete }
  }
}
</script>
```

Key point: Teleport's `to` accepts any CSS selector. When the component unmounts, Teleport's content is removed automatically too.

## Fragment: No More Unnecessary Wrapper Nodes

Vue 2 required a template to have a single root node, which led to lots of meaningless `<div>` wrapper layers. Vue 3 supports multiple root nodes.

```vue
<template>
  <!-- Vue 2 必须包裹一层 div -->
  <!-- Vue 3 可以直接多个根节点 -->
  <header>
    <nav>
      <a href="/">首页</a>
      <a href="/about">关于</a>
    </nav>
  </header>
  <main>
    <slot />
  </main>
  <footer>
    <p>&copy; 2020 Vue Blog</p>
  </footer>
</template>

<script>
export default {
  name: 'Layout'
}
</script>
```

Note: with multiple root nodes you can't pass `$attrs` straight through to a root element; you must explicitly bind `v-bind="$attrs"` to a specific element.

## Suspense: Loading State for Async Components

Suspense can wait until nested async dependencies (async components or an async `setup` inside a component) are all ready before rendering.

```vue
<template>
  <Suspense>
    <template #default>
      <UserProfile :userId="1" />
    </template>
    <template #fallback>
      <div class="loading-skeleton">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-text short"></div>
      </div>
    </template>
  </Suspense>
</template>

<script>
import { defineAsyncComponent } from 'vue'

const UserProfile = defineAsyncComponent({
  loader: () => import('./components/UserProfile.vue'),
  loadingComponent: {
    template: '<div>加载中...</div>'
  },
  delay: 200,
  timeout: 10000
})

export default {
  components: { UserProfile }
}
</script>
```

Combined with async operations in `setup`, Suspense can wait for the `setup` function to return a Promise.

```vue
<script>
import { ref } from 'vue'

export default {
  async setup() {
    const data = ref(null)
    // setup 返回 Promise，Suspense 会等待它完成
    const res = await fetch('/api/user/profile')
    data.value = await res.json()
    return { data }
  }
}
</script>
```

## Combining the Three Features

In real projects these three features are often used together. For example, an asynchronously loaded global dialog:

```vue
<template>
  <Teleport to="body">
    <Suspense>
      <template #default>
        <AsyncDialog v-if="visible" @close="visible = false" />
      </template>
      <template #fallback>
        <div class="dialog-loading">加载弹窗组件中...</div>
      </template>
    </Suspense>
  </Teleport>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'

const AsyncDialog = defineAsyncComponent(() =>
  import('./HeavyDialog.vue')
)

export default {
  components: { AsyncDialog },
  props: { visible: Boolean }
}
</script>
```

## Summary

- Teleport solves the classic problem of modals/tooltips being affected by parent CSS—the component logic stays put, only the DOM moves.
- Fragment eliminates meaningless wrapper nodes, but watch out for the explicit `$attrs` binding.
- Suspense unifies the loading state for async components and async `setup`, replacing manual loading states.
- The three features can be combined freely to build more flexible component structures.
