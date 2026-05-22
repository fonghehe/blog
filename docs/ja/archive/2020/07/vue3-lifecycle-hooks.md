---
title: "Vue 3 ライフサイクルフック：Composition API版"
date: 2020-07-06 15:09:20
tags:
  - Vue
readingTime: 4
description: "Vue 3 の Composition API ではライフサイクルフックが再設計されました。従来の Options API では mounted や created といったオプションを使用していましたが、setup() 関数内では対応する onXxx 形式を使用する必要があります。社内コンポーネントライブラリを Composition API に移行する過程で、いくつかの課題に直面しました。"
wordCount: 709
---

Vue 3 の Composition API ではライフサイクルフックが再設計されました。以前は Options API で `mounted` や `created` といったオプションを使用していましたが、現在は `setup()` 関数内で対応する `onXxx` 形式を使用する必要があります。社内コンポーネントライブラリを Composition API に移行する過程でいくつかの問題に直面したため、それらを整理しました。

## Options API と Composition API フックの対応表

| Options API | Composition API |
|---|---|
| beforeCreate | (不需要，setup 本身就是) |
| created | (不需要，setup 本身就是) |
| beforeMount | onBeforeMount |
| mounted | onMounted |
| beforeUpdate | onBeforeUpdate |
| updated | onUpdated |
| beforeUnmount | onBeforeUnmount |
| unmounted | onUnmounted |
| errorCaptured | onErrorCaptured |

`beforeCreate` と `created` は Composition API では不要です。なぜなら `setup()` の実行タイミング自体がこの両者の間にあるからです。

## 基本的な使い方

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

    // DOM のマウント前、初期化の準備に適しています
    onBeforeMount(() => {
      console.log('组件即将挂载，此时还没有 DOM 节点')
    })

    // DOM のマウントが完了しました。DOM を安全に操作できます
    onMounted(async () => {
      console.log('组件已挂载，DOM 可用')
      // この時点で containerRef.value に値があります
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

    // リアクティブデータの変更により DOM が再レンダリングされる前
    onBeforeUpdate(() => {
      console.log('组件即将更新')
      // ここで更新前の DOM 状態にアクセスできます
    })

    // DOM の更新が完了しました
    onUpdated(() => {
      console.log('组件已更新')
      // updated 内でリアクティブデータを変更しないでください。無限ループの原因になります
    })

    // コンポーネントのアンマウント前、副作用のクリーンアップに適しています
    onBeforeUnmount(() => {
      console.log('组件即将卸载')
    })

    // コンポーネントがアンマウントされました
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

## 同じフックの複数登録

これは Composition API が Options API に比べて持つ重要な利点です。同じライフサイクルフックを複数回登録でき、登録順に従って順次実行されます。

```typescript
import { onMounted, onUnmounted } from 'vue'

// 各 useXxx は独自のライフサイクルロジックを独立して登録できます
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
    // 2 つの use 関数がそれぞれ onMounted と onUnmounted を登録しています
    // 両方とも正しく実行され、互いに上書きされることはありません
    const { scrollY } = useScrollTracking()
    const { width } = useResizeObserver()

    return { scrollY, width }
  }
}
```

## onErrorCaptured エラーバウンダリ

このフックは Vue 3 でも引き続き利用可能で、React の ErrorBoundary に似たエラー捕捉機構を構築できます。

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

      // 監視プラットフォームに報告
      console.error('组件错误被捕获:', {
        message: err.message,
        stack: err.stack,
        component: instance?.$options.name || 'Anonymous',
        lifecycleHook: info
      })

      // false を返してエラーの上位伝播を防ぐ
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

## watchとの実行順序

見落としがちな点：`setup()` で登録した `watch`（`watchEffect` 以外）はデフォルトでコンポーネント更新の**前**に実行されます。また、`onMounted` で起動した副作用も正しく `watch` をトリガーします。ただし、`watch` の flush オプションに注意が必要です。

```typescript
import { ref, watch, onUpdated } from 'vue'

export default {
  setup() {
    const count = ref(0)

    // デフォルトの pre：コンポーネント更新前に実行
    watch(count, () => {
      console.log('watch pre (默认)')
    })

    // post：コンポーネント更新後に実行。onUpdated に似ていますが、特定のデータが変化したときのみトリガーされます
    watch(count, () => {
      console.log('watch post')
    }, { flush: 'post' })

    // sync：同期的に実行。ほとんど使用されません
    watch(count, () => {
      console.log('watch sync')
    }, { flush: 'sync' })

    onUpdated(() => {
      console.log('onUpdated')
    })

    // クリック後の出力順序：
    // watch pre -> watch sync（登録順による。sync が先に実行）-> onUpdated -> watch post
    // 実際には sync はデータ変更時に即座に実行され、順序の影響を受けません
    return { count }
  }
}
```

実際の出力順序は複雑ですが、核となる原則は次のとおりです：`sync` が最初（データ変更時に即座に実行）、次に `pre`（DOM 更新前）、次に `onUpdated`（DOM 更新後）、最後に `post` の watch です。

## まとめ

- Composition API のライフサイクルフックは `onXxx` 関数として `setup()` 内で呼び出します
- `beforeCreate` と `created` は不要になりました。`setup()` 自体がこの段階をカバーしています
- 各フックは複数回登録でき、登録順に実行されるため、ロジックの再利用に最適です
- `onErrorCaptured` を使用して React の ErrorBoundary に類似したエラーバウンダリを実装できます
- `watch` の `flush` オプションとライフサイクルフックの実行順序の関係に注意してください
- `onUnmounted` 内で必ずイベントリスナー、タイマー、Observer などの副作用をクリーンアップしてください
