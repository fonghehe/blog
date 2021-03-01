---
title: "Vue 3 Teleport 与 Suspense 组件"
date: 2020-08-03 14:49:22
tags:
  - Vue
---

Vue 3 新增了两个内置组件：Teleport 和 Suspense。一个解决 DOM 结构嵌套问题，一个解决异步组件加载状态问题。这两个在实际项目中用得非常频繁，特别是 Teleport，几乎是模态框组件的标配了。

## Teleport：把组件渲染到 DOM 树的任意位置

### 为什么需要 Teleport

做弹窗、Toast、Drawer 这类浮层组件时，我们经常遇到一个问题：组件的 DOM 结构嵌套在父组件里，但我们需要它渲染到 body 下面，否则会被 `overflow: hidden` 或 `z-index` 影响。

以前的解决方案是：手动操作 DOM，或者用 Portal 库。Vue 3 的 Teleport 是原生方案。

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

### Teleport 的目标选择器

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

### 多个 Teleport 到同一目标

多个 Teleport 可以渲染到同一个目标元素，它们按声明顺序追加：

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

### 禁用 Teleport

有时候在某些条件下需要禁用 Teleport（比如单元测试时）：

```vue
<template>
  <!-- disabled 时不会 Teleport，仍在原位渲染 -->
  <Teleport to="body" :disabled="isTesting">
    <Modal />
  </Teleport>
</template>
```

### 实战：全局 Toast 组件

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

## Suspense：处理异步依赖

### 基本用法

Suspense 让我们可以声明式地处理异步组件的加载状态。当子组件（或子组件内的 setup 函数）返回 Promise 时，Suspense 会等待 Promise 完成：

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

### 配合 async setup 使用

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

### 嵌套 Suspense

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

### 配合 Teleport + Suspense

一个常见的场景：弹窗内有异步数据加载。Teleport 负责渲染位置，Suspense 负责加载状态：

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

### 错误处理

Suspense 目前没有专门的 error 插槽（这还在 RFC 讨论中），需要配合 `onErrorCaptured` 处理错误：

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

## 注意事项

1. **Suspense 仍然是实验性特性** —— Vue 3 正式发布时 Suspense 还是 experimental 状态，API 可能会变，生产环境慎用
2. **Teleport 的组件实例关系不变** —— 虽然 DOM 渲染到了别处，但 Vue 组件树中的父子关系不变，provide/inject 照常工作
3. **Suspense 要求 setup 是 async 的或使用了 defineAsyncComponent** —— 普通的 setup 函数不会触发 Suspense

## 小结

- Teleport 将子组件的 DOM 渲染到指定位置，解决模态框/Toast 等浮层的 z-index 和 overflow 问题
- Teleport 支持动态目标、多个 Teleport 到同一目标、以及禁用模式
- Suspense 声明式处理异步组件的加载和错误状态
- Suspense 支持嵌套，可以实现更细粒度的加载控制
- Suspense 目前仍是实验性特性，生产使用要关注 API 变化
- Teleport + Suspense 组合是处理异步弹窗内容的最佳实践
