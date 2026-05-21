---
title: "Vue 3 生命週期鉤子 Composition API 版本"
date: 2020-07-06 15:09:20
tags:
  - Vue
readingTime: 3
description: "Vue 3 Composition API 對生命週期鉤子做了重新設計。過去我們在 Options API 中使用 `mounted`、`created` 這些選項，現在在 `setup()` 函式中，需要改用對應的 `onXxx` 形式。這段時間在把內部元件庫往 Composition API 遷移的過程中，踩了一些"
wordCount: 485
---

Vue 3 Composition API 對生命週期鉤子做了重新設計。過去我們在 Options API 中使用 `mounted`、`created` 這些選項，現在在 `setup()` 函式中，需要改用對應的 `onXxx` 形式。這段時間在把內部元件庫往 Composition API 遷移的過程中，踩了一些坑，整理一下。

## Options API vs Composition API 鉤子對照

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

`beforeCreate` 和 `created` 在 Composition API 中不需要了，因為 `setup()` 的執行時機本身就在這兩者之間。

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

    // 在 DOM 掛載之前，適合做初始化準備工作
    onBeforeMount(() => {
      console.log('元件即將掛載，此時還沒有 DOM 節點')
    })

    // DOM 已經掛載完畢，可以安全操作 DOM
    onMounted(async () => {
      console.log('元件已掛載，DOM 可用')
      // 此時 containerRef.value 有值
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

    // 響應式資料變更導致 DOM 重新渲染前
    onBeforeUpdate(() => {
      console.log('元件即將更新')
      // 可以在這裡訪問更新前的 DOM 狀態
    })

    // DOM 已經更新完畢
    onUpdated(() => {
      console.log('元件已更新')
      // 不要在 updated 中修改響應式資料，可能導致無限迴圈
    })

    // 元件解除安裝之前，適合清理副作用
    onBeforeUnmount(() => {
      console.log('元件即將解除安裝')
    })

    // 元件已經解除安裝
    onUnmounted(() => {
      console.log('元件已解除安裝')
    })

    return {
      users,
      loading,
      containerRef
    }
  }
}
```

## 多次註冊同一鉤子

這是 Composition API 相比 Options API 的一個重要優勢——同一個生命週期鉤子可以註冊多次，它們會按照註冊順序依次執行：

```typescript
import { onMounted, onUnmounted } from 'vue'

// 每個 useXxx 都可以獨立註冊自己的生命週期邏輯
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
    // 兩個 use 函式各自注冊了 onMounted 和 onUnmounted
    // 都會被正確執行，不會互相覆蓋
    const { scrollY } = useScrollTracking()
    const { width } = useResizeObserver()

    return { scrollY, width }
  }
}
```

## onErrorCaptured 錯誤邊界

這個鉤子在 Vue 3 中依然保留，可以用來構建類似 React ErrorBoundary 的錯誤捕獲機制：

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

      // 上報到監控平臺
      console.error('元件錯誤被捕獲:', {
        message: err.message,
        stack: err.stack,
        component: instance?.$options.name || 'Anonymous',
        lifecycleHook: info
      })

      // 返回 false 阻止錯誤繼續向上傳播
      return false
    })

    return () => {
      if (hasError.value && error.value) {
        return h('div', { class: 'error-boundary' }, [
          h('h3', '出了點問題'),
          h('p', error.value.message),
          h('button', {
            onClick: () => {
              hasError.value = false
              error.value = null
            }
          }, '重試')
        ])
      }
      return slots.default?.()
    }
  }
})
```

## 和 watch 的執行順序

一個容易忽略的點：在 `setup()` 中註冊的 `watch`（非 `watchEffect`）預設是在元件更新**之前**執行的，而 `onMounted` 中發起的副作用也會正確觸發 `watch`。但要注意 `watch` 的 flush 選項：

```typescript
import { ref, watch, onUpdated } from 'vue'

export default {
  setup() {
    const count = ref(0)

    // 預設 pre：在元件更新前執行
    watch(count, () => {
      console.log('watch pre (預設)')
    })

    // post：在元件更新後執行，類似 onUpdated 但只在特定資料變化時觸發
    watch(count, () => {
      console.log('watch post')
    }, { flush: 'post' })

    // sync：同步執行，很少用
    watch(count, () => {
      console.log('watch sync')
    }, { flush: 'sync' })

    onUpdated(() => {
      console.log('onUpdated')
    })

    // 點選後輸出順序：
    // watch pre -> watch sync (取決於註冊順序，sync 會先執行) -> onUpdated -> watch post
    // 實際上 sync 會在資料變更時立即執行，不受順序影響
    return { count }
  }
}
```

實際輸出順序比較複雜，但核心原則是：`sync` 最先（資料變化時立即執行），然後是 `pre`（DOM 更新前），然後是 `onUpdated`（DOM 更新後），最後是 `post` 的 watch。

## 小結

- Composition API 的生命週期鉤子以 `onXxx` 函式形式在 `setup()` 中呼叫
- `beforeCreate` 和 `created` 不再需要，`setup()` 本身就覆蓋了這個階段
- 每個鉤子可以註冊多次，按註冊順序執行，非常適合邏輯複用
- `onErrorCaptured` 可以實現類似 React ErrorBoundary 的錯誤邊界
- 注意 `watch` 的 `flush` 選項和生命週期鉤子的執行順序關係
- 在 `onUnmounted` 中務必清理事件監聽、定時器、Observer 等副作用
