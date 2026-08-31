---
title: "Vue 3 Teleport and Suspense Components"
date: 2020-08-03 14:49:22
tags:
  - Vue
readingTime: 4
description: "A guide to Vue 3's Teleport and Suspense built-in components, solving DOM nesting and async loading state problems that arise frequently in real projects."
wordCount: 438
---

Vue 3 introduced two built-in components: Teleport and Suspense. One solves the problem of nested DOM structure, and the other handles the loading state of async components. Both are used very frequently in real projects — Teleport in particular is practically standard for modal components.

## Teleport: Rendering Components Anywhere in the DOM

### Why Teleport Is Needed

When building overlay components like modals, toasts, and drawers, we often run into a problem: the component's DOM is nested inside its parent, but we need it to render under `body`, otherwise it gets affected by `overflow: hidden` or `z-index`.

The traditional solutions were to manipulate the DOM manually or use a Portal library. Vue 3's Teleport is the native solution.

```vue
<template>
  <div class="modal-wrapper">
    <!-- 这个按钮在当前组件内 -->
    <button @click="showModal = true">打开弹窗</button>

    <!-- 弹窗 DOM 实际会被渲染到 body 下面 -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-content">
          <header>
            <h3>确认操作</h3>
            <button @click="showModal = false">&times;</button>
          </header>
          <section>
            <slot />
          </section>
          <footer>
            <button @click="showModal = false">取消</button>
            <button @click="handleConfirm">确认</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>
```

### Teleport Target Selectors

```vue
<template>
  <!-- 渲染到 body -->
  <Teleport to="body">
    <Toast message="操作成功" />
  </Teleport>

  <!-- 渲染到指定的 DOM 元素 -->
  <Teleport to="#app-portal">
    <NotificationPanel />
  </Teleport>

  <!-- 动态目标 -->
  <Teleport :to="targetSelector">
    <DynamicContent />
  </Teleport>
</template>

<script>
import { ref } from 'vue'

const targetSelector = ref('#sidebar')
// 可以动态切换目标
function moveToFooter() {
  targetSelector.value = '#footer'
}
</script>
```

### Multiple Teleports to the Same Target

Multiple Teleports can render to the same target element; they are appended in declaration order:

```vue
<template>
  <!-- 第一个通知 -->
  <Teleport to="#notification-area">
    <Toast message="第一条通知" />
  </Teleport>

  <!-- 第二个通知，会追加到同一个容器中 -->
  <Teleport to="#notification-area">
    <Toast message="第二条通知" />
  </Teleport>
</template>
```

### Disabling Teleport

Sometimes you need to disable Teleport under certain conditions (for example, during unit testing):

```vue
<template>
  <!-- disabled 时不会 Teleport，仍在原位渲染 -->
  <Teleport to="body" :disabled="isTesting">
    <Modal />
  </Teleport>
</template>
```

### In Practice: Global Toast Component

```typescript
{% raw %}
// composables/useToast.ts
import { ref, markRaw } from 'vue'

interface ToastOptions {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

const toasts = ref<ToastItem[]>([])
let idCounter = 0

export function useToast() {
  function show(options: ToastOptions) {
    const id = ++idCounter
    toasts.value.push({
      id,
      message: options.message,
      type: options.type || 'info',
      duration: options.duration || 3000
    })

    setTimeout(() => {
      remove(id)
    }, options.duration || 3000)
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, remove }
}

// ToastContainer.vue
// <template>
//   <Teleport to="body">
//     <div class="toast-container">
//       <TransitionGroup name="toast">
//         <div
//           v-for="toast in toasts"
//           :key="toast.id"
//           :class="['toast', `toast--${toast.type}`]"
//         >
//           {{ toast.message }}
//           <button @click="remove(toast.id)">&times;</button>
//         </div>
//       </TransitionGroup>
//     </div>
//   </Teleport>
// </template>
{% endraw %}
```

## Suspense: Handling Async Dependencies

### Basic Usage

Suspense lets us handle the loading state of async components declaratively. When a child component (or the `setup` function inside it) returns a Promise, Suspense waits for that Promise to resolve:

```vue
<template>
  <Suspense>
    <!-- 默认插槽：异步内容 -->
    <template #default>
      <UserProfile :user-id="userId" />
    </template>

    <!-- fallback 插槽：加载中的占位 -->
    <template #fallback>
      <div class="loading-skeleton">
        <div class="skeleton-avatar" />
        <div class="skeleton-text" />
        <div class="skeleton-text skeleton-text--short" />
      </div>
    </template>
  </Suspense>
</template>
```

### Using with async setup

```vue
{% raw %}
<!-- UserProfile.vue -->
<template>
  <div class="user-profile">
    <img :src="user.avatar" :alt="user.name" />
    <h2>{{ user.name }}</h2>
    <p>{{ user.bio }}</p>
    <div class="stats">
      <span>{{ user.followers }} 粉丝</span>
      <span>{{ user.following }} 关注</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

const props = defineProps<{ userId: string }>()

// setup 可以是 async 的，Suspense 会自动等待
const res = await fetch(`/api/users/${props.userId}`)
const user = await res.json()

// 如果 fetch 失败，错误会被 Suspense 的 error 捕获
</script>
{% endraw %}
```

### Nested Suspense

可以嵌套 Suspense 实现更细粒度的加载控制：

```vue
<template>
  <Suspense>
    <template #default>
      <div class="page">
        <!-- 先加载页面级数据 -->
        <PageHeader />

        <!-- 内层 Suspense：独立控制内容区的加载 -->
        <Suspense>
          <template #default>
            <ContentArea />
          </template>
          <template #fallback>
            <ContentSkeleton />
          </template>
        </Suspense>

        <PageFooter />
      </div>
    </template>

    <template #fallback>
      <FullPageLoader />
    </template>
  </Suspense>
</template>
```

### Combining Teleport + Suspense

A common scenario: a modal that loads async data inside it. Teleport handles the render location, while Suspense handles the loading state:

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay">
      <div class="modal">
        <Suspense>
          <template #default>
            <OrderDetail :order-id="orderId" />
          </template>
          <template #fallback>
            <div class="modal-loading">
              <Spinner />
              <span>加载订单详情中...</span>
            </div>
          </template>
        </Suspense>
      </div>
    </div>
  </Teleport>
</template>
```

### Error Handling

Suspense doesn't yet have a dedicated error slot (this is still under RFC discussion), so you need to handle errors with `onErrorCaptured`:

```vue
{% raw %}
<template>
  <div v-if="hasError" class="error-state">
    <p>加载失败: {{ errorMessage }}</p>
    <button @click="retry">重试</button>
  </div>
  <Suspense v-else>
    <template #default>
      <AsyncComponent :key="retryCount" />
    </template>
    <template #fallback>
      <LoadingSpinner />
    </template>
  </Suspense>
</template>

<script>
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')
const retryCount = ref(0)

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err.message
  return false // 阻止错误继续传播
})

function retry() {
  hasError.value = false
  retryCount.value++ // 通过 key 变化强制重新渲染
}
</script>
{% endraw %}
```

## Important Notes

1. **Suspense is still an experimental feature** — at the time of Vue 3's official release, Suspense was still in experimental status, and its API may change, so use it with caution in production
2. **Teleport preserves component instance relationships** — although the DOM is rendered elsewhere, the parent-child relationship in the Vue component tree stays the same, and provide/inject continues to work as usual
3. **Suspense requires an async `setup` or `defineAsyncComponent`** — a normal `setup` function won't trigger Suspense

## Summary

- Teleport renders a child component's DOM to a specified location, solving the z-index and overflow issues of overlays like modals and toasts
- Teleport supports dynamic targets, multiple Teleports to the same target, and a disabled mode
- Suspense declaratively handles the loading and error states of async components
- Suspense supports nesting, enabling finer-grained loading control
- Suspense is still experimental, so watch for API changes if you use it in production
- Combining Teleport + Suspense is the best practice for handling async modal content
