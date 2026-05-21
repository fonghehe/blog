---
title: "Vue 3 生命周期钩子 Composition API 版本"
date: 2020-07-06 15:09:20
tags:
  - Vue
readingTime: 3
description: "Vue 3 Composition API 对生命周期钩子做了重新设计。过去我们在 Options API 中使用 `mounted`、`created` 这些选项，现在在 `setup()` 函数中，需要改用对应的 `onXxx` 形式。这段时间在把内部组件库往 Composition API 迁移的过程中，踩了一些"
wordCount: 485
---

Vue 3 Composition API 对生命周期钩子做了重新设计。过去我们在 Options API 中使用 `mounted`、`created` 这些选项，现在在 `setup()` 函数中，需要改用对应的 `onXxx` 形式。这段时间在把内部组件库往 Composition API 迁移的过程中，踩了一些坑，整理一下。

## Options API vs Composition API 钩子对照

| Options API | Composition API |
|
---|---|
| beforeCreate | (不需要，setup 本身就是) |
| created | (不需要，setup 本身就是) |
| beforeMount | onBeforeMount |
| mounted | onMounted |
| beforeUpdate | onBeforeUpdate |
| updated | onUpdated |
| beforeUnmount | onBeforeUnmount |
| unmounted | onUnmounted |
| errorCaptured | onErrorCaptured |

`beforeCreate` 和 `created` 在 Composition API 中不需要了，因为 `setup()` 的执行时机本身就在这两者之间。

## 基本用法

```typescript
import {
  ref,
  onMounted,
  onBeforeMount,
  onBeforeUnmount,
  onUnmounted,
  onBeforeUpdate,
  onUpdated,
  onErrorCaptured
} from 'vue'

interface User {
  id: number
  name: string
  avatar: string
}

export default {
  setup() {
    const users = ref<User[]>([])
    const loading = ref(true)
    const containerRef = ref<HTMLElement | null>(null)

    // 在 DOM 挂载之前，适合做初始化准备工作
    onBeforeMount(() => {
      console.log('组件即将挂载，此时还没有 DOM 节点')
    })

    // DOM 已经挂载完毕，可以安全操作 DOM
    onMounted(async () => {
      console.log('组件已挂载，DOM 可用')
      // 此时 containerRef.value 有值
      if (containerRef.value) {
        containerRef.value.style.opacity = '1'
      }

      try {
        const res = await fetch('/api/users')
        users.value = await res.json()
      } finally {
        loading.value = false
      }
    })

    // 响应式数据变更导致 DOM 重新渲染前
    onBeforeUpdate(() => {
      console.log('组件即将更新')
      // 可以在这里访问更新前的 DOM 状态
    })

    // DOM 已经更新完毕
    onUpdated(() => {
      console.log('组件已更新')
      // 不要在 updated 中修改响应式数据，可能导致无限循环
    })

    // 组件卸载之前，适合清理副作用
    onBeforeUnmount(() => {
      console.log('组件即将卸载')
    })

    // 组件已经卸载
    onUnmounted(() => {
      console.log('组件已卸载')
    })

    return {
      users,
      loading,
      containerRef
    }
  }
}
```

## 多次注册同一钩子

这是 Composition API 相比 Options API 的一个重要优势——同一个生命周期钩子可以注册多次，它们会按照注册顺序依次执行：

```typescript
import { onMounted, onUnmounted } from 'vue'

// 每个 useXxx 都可以独立注册自己的生命周期逻辑
function useScrollTracking() {
  const scrollY = ref(0)

  function handleScroll() {
    scrollY.value = window.scrollY
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })

  return { scrollY }
}

function useResizeObserver() {
  const width = ref(window.innerWidth)
  let observer: ResizeObserver | null = null

  onMounted(() => {
    observer = new ResizeObserver((entries) => {
      width.value = entries[0].contentRect.width
    })
    observer.observe(document.documentElement)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { width }
}

export default {
  setup() {
    // 两个 use 函数各自注册了 onMounted 和 onUnmounted
    // 都会被正确执行，不会互相覆盖
    const { scrollY } = useScrollTracking()
    const { width } = useResizeObserver()

    return { scrollY, width }
  }
}
```

## onErrorCaptured 错误边界

这个钩子在 Vue 3 中依然保留，可以用来构建类似 React ErrorBoundary 的错误捕获机制：

```typescript
import { onErrorCaptured, ref, defineComponent, h } from 'vue'

const ErrorBoundary = defineComponent({
  name: 'ErrorBoundary',
  setup(_, { slots }) {
    const hasError = ref(false)
    const error = ref<Error | null>(null)

    onErrorCaptured((err: Error, instance, info) => {
      hasError.value = true
      error.value = err

      // 上报到监控平台
      console.error('组件错误被捕获:', {
        message: err.message,
        stack: err.stack,
        component: instance?.$options.name || 'Anonymous',
        lifecycleHook: info
      })

      // 返回 false 阻止错误继续向上传播
      return false
    })

    return () => {
      if (hasError.value && error.value) {
        return h('div', { class: 'error-boundary' }, [
          h('h3', '出了点问题'),
          h('p', error.value.message),
          h('button', {
            onClick: () => {
              hasError.value = false
              error.value = null
            }
          }, '重试')
        ])
      }
      return slots.default?.()
    }
  }
})
```

## 和 watch 的执行顺序

一个容易忽略的点：在 `setup()` 中注册的 `watch`（非 `watchEffect`）默认是在组件更新**之前**执行的，而 `onMounted` 中发起的副作用也会正确触发 `watch`。但要注意 `watch` 的 flush 选项：

```typescript
import { ref, watch, onUpdated } from 'vue'

export default {
  setup() {
    const count = ref(0)

    // 默认 pre：在组件更新前执行
    watch(count, () => {
      console.log('watch pre (默认)')
    })

    // post：在组件更新后执行，类似 onUpdated 但只在特定数据变化时触发
    watch(count, () => {
      console.log('watch post')
    }, { flush: 'post' })

    // sync：同步执行，很少用
    watch(count, () => {
      console.log('watch sync')
    }, { flush: 'sync' })

    onUpdated(() => {
      console.log('onUpdated')
    })

    // 点击后输出顺序：
    // watch pre -> watch sync (取决于注册顺序，sync 会先执行) -> onUpdated -> watch post
    // 实际上 sync 会在数据变更时立即执行，不受顺序影响
    return { count }
  }
}
```

实际输出顺序比较复杂，但核心原则是：`sync` 最先（数据变化时立即执行），然后是 `pre`（DOM 更新前），然后是 `onUpdated`（DOM 更新后），最后是 `post` 的 watch。

## 小结

- Composition API 的生命周期钩子以 `onXxx` 函数形式在 `setup()` 中调用
- `beforeCreate` 和 `created` 不再需要，`setup()` 本身就覆盖了这个阶段
- 每个钩子可以注册多次，按注册顺序执行，非常适合逻辑复用
- `onErrorCaptured` 可以实现类似 React ErrorBoundary 的错误边界
- 注意 `watch` 的 `flush` 选项和生命周期钩子的执行顺序关系
- 在 `onUnmounted` 中务必清理事件监听、定时器、Observer 等副作用
