---
title: "Vue 3 Lifecycle Hooks: Composition API Edition"
date: 2020-07-06 15:09:20
tags:
  - Vue
readingTime: 3
description: "A guide to Vue 3 Composition API lifecycle hooks, covering the migration from Options API options to onXxx functions and common pitfalls encountered along the way."
wordCount: 333
---

Vue 3's Composition API redesigns lifecycle hooks. In the past we used options like `mounted` and `created` in the Options API; now, inside the `setup()` function, we use the corresponding `onXxx` form instead. While migrating our internal component library to the Composition API recently, I hit a few pitfalls and want to write them down.

## Options API vs Composition API Hook Comparison

| Options API | Composition API |
|---|---|
| beforeCreate | (not needed — `setup()` itself covers this) |
| created | (not needed — `setup()` itself covers this) |
| beforeMount | onBeforeMount |
| mounted | onMounted |
| beforeUpdate | onBeforeUpdate |
| updated | onUpdated |
| beforeUnmount | onBeforeUnmount |
| unmounted | onUnmounted |
| errorCaptured | onErrorCaptured |

`beforeCreate` and `created` are no longer needed in the Composition API, because `setup()` runs exactly during that window.

## Basic Usage

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

## Registering the Same Hook Multiple Times

This is a key advantage of the Composition API over the Options API — the same lifecycle hook can be registered multiple times, and they run in registration order:

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

## onErrorCaptured Error Boundary

This hook is still available in Vue 3 and can be used to build an error-capturing mechanism similar to React's ErrorBoundary:

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

## Execution Order with watch

An easily overlooked point: a `watch` registered in `setup()` (not `watchEffect`) runs **before** the component updates by default, and side effects kicked off in `onMounted` also correctly trigger `watch`. But pay attention to `watch`'s flush option:

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

The actual output order is fairly complex, but the core principle is: `sync` runs first (immediately when the data changes), then `pre` (before the DOM updates), then `onUpdated` (after the DOM updates), and finally the `post` watch.

## Summary

- Composition API lifecycle hooks are called as `onXxx` functions inside `setup()`.
- `beforeCreate` and `created` are no longer needed — `setup()` itself covers that phase.
- Each hook can be registered multiple times and runs in registration order, which is great for logic reuse.
- `onErrorCaptured` can implement an error boundary similar to React's ErrorBoundary.
- Mind the relationship between `watch`'s `flush` option and the lifecycle hook execution order.
- Always clean up side effects in `onUnmounted` — event listeners, timers, observers, and the like.
