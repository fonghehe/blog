---
title: "Vue 3 Composition API 深度解析：从 Options 到 Composition 的移行"
date: 2020-01-01 15:25:34
tags:
  - Vue
readingTime: 3
description: "Vue 3 的 Composition API 是自 Vue 诞生以来最重大的范式转变。对于习惯了 Options API 的开发者来说，这套 API 的学习曲线并不陡峭，但要真正用好它，需要理解其设计哲学和底层机制。本文从实际工程角度出发，剖析 Composition API 的核心用法。"
wordCount: 667
---

Vue 3 の Composition API は、Vue 誕生以来もっとも大きなパラダイムシフトだ。Options API に慣れた開発者にとって学習曲線はそれほど急ではないが、本当に使いこなすにはその設計思想と背後にある仕組みを理解する必要がある。本稿では実際の開発の観点から、Composition API の主要な使い方を掘り下げる。

## setup関数とリアクティビティの基礎

`setup` は Composition API の入り口で、コンポーネントの生成前に実行され、`props` と `context` の2つの引数を受け取る。すべてのリアクティブな状態、算出プロパティ、メソッドはここで定義する。

```javascript
import { ref, reactive, toRefs } from 'vue'

export default {
  props: {
    userId: {
      type: Number,
      required: true
    }
  },
  setup(props, { emit, attrs, slots }) {
    // ref 用于基本类型
    const count = ref(0)

    // reactive 用于对象
    const state = reactive({
      username: '',
      posts: [],
      loading: false
    })

    // 直接修改 reactive 对象的属性即可触发更新
    const fetchUser = async () => {
      state.loading = true
      const res = await fetch(`/api/users/${props.userId}`)
      const data = await res.json()
      state.username = data.name
      state.posts = data.posts
      state.loading = false
    }

    fetchUser()

    // 如果要用模板解构，需要 toRefs
    return {
      count,
      increment: () => count.value++,
      ...toRefs(state)
    }
  }
}
```

`ref` が返すオブジェクトは JS 上では `.value` を通してアクセスする必要があり、テンプレートでは自動的にアンラップされる。これは多くの初学者がハマりやすい点だ。

## カスタム再利用可能ロジック

Composition API の最も強力な点はロジックの再利用だ。以前 mixins を使うと名前の衝突や出自が分からない問題があったが、今は composables で依存関係を明確に管理できる。

```javascript
// composables/useMousePosition.js
import { ref, onMounted, onUnmounted } from 'vue'

export function useMousePosition() {
  const x = ref(0)
  const y = ref(0)

  const update = (e) => {
    x.value = e.pageX
    y.value = e.pageY
  }

  onMounted(() => {
    window.addEventListener('mousemove', update)
  })

  onUnmounted(() => {
    window.removeEventListener('mousemove', update)
  })

  return { x, y }
}

// 使用例
import { useMousePosition } from './composables/useMousePosition'

export default {
  setup() {
    const { x, y } = useMousePosition()
    return { x, y }
  }
}
```

## watchEffectとwatchの使い分け

`watchEffect` は関数内のリアクティブな依存を自動的に追跡し、初回は即座に実行される。`watch` はデータソースを明示的に指定する必要がある。

```javascript
import { ref, watch, watchEffect } from 'vue'

export default {
  setup(props) {
    const keyword = ref('')
    const results = ref([])

    // watchEffect: 自动追踪 keyword，首次立即执行
    watchEffect(async () => {
      if (!keyword.value) return
      const res = await fetch(`/api/search?q=${keyword.value}`)
      results.value = await res.json()
    })

    // watch: 显式指定依赖，可以拿到新旧值
    watch(keyword, (newVal, oldVal) => {
      console.log(`搜索词从 "${oldVal}" 变为 "${newVal}"`)
    })

    return { keyword, results }
  }
}
```

選び方の指針：旧値の取得やトリガー条件の厳密な制御が必要なら `watch`、複数の依存を自動追跡したいなら `watchEffect` を使う。

## ライフサイクルフックのマッピング

Composition API のライフサイクルフックはすべて `on` で始まり、`setup` 内でのみ有効だ。

```javascript
import { onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount } from 'vue'

export default {
  setup() {
    onBeforeMount(() => {
      console.log('组件即将挂载')
    })

    onMounted(() => {
      console.log('组件已挂载，可以访问 DOM')
    })

    onBeforeUpdate(() => {
      console.log('组件即将更新')
    })

    onUpdated(() => {
      console.log('组件已更新')
    })

    onBeforeUnmount(() => {
      console.log('组件即将卸载')
    })

    onUnmounted(() => {
      console.log('组件已卸载')
    })
  }
}
```

## まとめ

- Composition API の核心は `setup` 関数で、すべてのロジックはここから組み立てる
- `ref` は基本型に、`reactive` はオブジェクトに使い、`.value` の使い分けに注意
- Composables は mixins に代わり、名前の衝突や出自が分からない問題を解決する
- `watchEffect` は依存を自動追跡し、`watch` は明示的に指定して旧値を取得できる
- ライフサイクルフックはすべて `on` 接頭辞で名前が付き、`setup` 内でのみ呼び出せる
