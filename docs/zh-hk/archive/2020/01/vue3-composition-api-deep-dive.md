---
title: "Vue 3 Composition API 深度解析"
date: 2020-01-01 15:25:34
tags:
  - Vue
readingTime: 2
description: "Vue 3 的 Composition API 是自 Vue 誕生以來最重大的範式轉變。對於習慣了 Options API 的開發者來説，這套 API 的學習曲線並不陡峭，但要真正用好它，需要理解其設計哲學和底層機制。本文從實際工程角度出發，剖析 Composition API 的核心用法。"
---

Vue 3 的 Composition API 是自 Vue 誕生以來最重大的範式轉變。對於習慣了 Options API 的開發者來説，這套 API 的學習曲線並不陡峭，但要真正用好它，需要理解其設計哲學和底層機制。本文從實際工程角度出發，剖析 Composition API 的核心用法。

## setup 函數與響應式基礎

`setup` 是 Composition API 的入口，它在組件創建之前執行，接收 `props` 和 `context` 兩個參數。所有響應式狀態、計算屬性、方法都在這裏定義。

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
    // ref 用於基本類型
    const count = ref(0)

    // reactive 用於對象
    const state = reactive({
      username: '',
      posts: [],
      loading: false
    })

    // 直接修改 reactive 對象的屬性即可觸發更新
    const fetchUser = async () => {
      state.loading = true
      const res = await fetch(`/api/users/${props.userId}`)
      const data = await res.json()
      state.username = data.name
      state.posts = data.posts
      state.loading = false
    }

    fetchUser()

    // 如果要用模板解構，需要 toRefs
    return {
      count,
      increment: () => count.value++,
      ...toRefs(state)
    }
  }
}
```

注意 `ref` 返回的對象在 JS 中訪問需要 `.value`，在模板中則自動解包。這是很多初學者容易踩的坑。

## 自定義可複用邏輯

Composition API 最強大的地方在於邏輯複用。過去用 mixins 會有命名衝突和來源不明的問題，現在用 composables 可以清晰地管理依賴。

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

// 使用
import { useMousePosition } from './composables/useMousePosition'

export default {
  setup() {
    const { x, y } = useMousePosition()
    return { x, y }
  }
}
```

## watchEffect 與 watch 的選擇

`watchEffect` 會自動追蹤函數內的響應式依賴，首次立即執行。`watch` 則需要顯式指定數據源。

```javascript
import { ref, watch, watchEffect } from 'vue'

export default {
  setup(props) {
    const keyword = ref('')
    const results = ref([])

    // watchEffect: 自動追蹤 keyword，首次立即執行
    watchEffect(async () => {
      if (!keyword.value) return
      const res = await fetch(`/api/search?q=${keyword.value}`)
      results.value = await res.json()
    })

    // watch: 顯式指定依賴，可以拿到新舊值
    watch(keyword, (newVal, oldVal) => {
      console.log(`搜索詞從 "${oldVal}" 變為 "${newVal}"`)
    })

    return { keyword, results }
  }
}
```

選擇建議：需要獲取舊值或精確控制觸發條件時用 `watch`；需要自動追蹤多個依賴時用 `watchEffect`。

## 生命週期鈎子的映射

Composition API 中的生命週期鈎子都以 `on` 開頭，且只在 `setup` 中有效。

```javascript
import { onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount } from 'vue'

export default {
  setup() {
    onBeforeMount(() => {
      console.log('組件即將掛載')
    })

    onMounted(() => {
      console.log('組件已掛載，可以訪問 DOM')
    })

    onBeforeUpdate(() => {
      console.log('組件即將更新')
    })

    onUpdated(() => {
      console.log('組件已更新')
    })

    onBeforeUnmount(() => {
      console.log('組件即將卸載')
    })

    onUnmounted(() => {
      console.log('組件已卸載')
    })
  }
}
```

## 小結

- Composition API 的核心是 `setup` 函數，所有邏輯從這裏組織
- `ref` 用於基本類型，`reactive` 用於對象，注意 `.value` 的使用場景
- Composables 替代 mixins，解決了命名衝突和來源不明的問題
- `watchEffect` 自動追蹤依賴，`watch` 顯式指定且可獲取舊值
- 生命週期鈎子全部以 `on` 前綴命名，只能在 `setup` 中調用
