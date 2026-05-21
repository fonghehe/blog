---
title: "Vue 3 Composition API 深掘り解析"
date: 2020-01-01 15:25:34
tags:
  - Vue
readingTime: 2
description: "Vue 3 的 Composition API 是自 Vue 诞生以来最重大的范式转变。对于习惯了 Options API 的开发者来说，这套 API 的学习曲线并不陡峭，但要真正用好它，需要理解其设计哲学和底层机制。本文从实际工程角度出发，剖析 Composition API 的核心用法。"
wordCount: 461
---

Vue 3 的 Composition API 是自 Vue 诞生以来最重大的范式转变。对于习惯了 Options API 的开发者来说，这套 API 的学习曲线并不陡峭，但要真正用好它，需要理解其设计哲学和底层机制。本文从实际工程角度出发，剖析 Composition API 的核心用法。

## setup関数とリアクティビティの基礎

`setup` 是 Composition API 的入口，它在组件创建之前执行，接收 `props` 和 `context` 两个参数。所有响应式状态、计算属性、方法都在这里定义。

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

注意 `ref` 返回的对象在 JS 中访问需要 `.value`，在模板中则自动解包。这是很多初学者容易踩的坑。

## カスタム再利用可能ロジック

Composition API 最强大的地方在于逻辑复用。过去用 mixins 会有命名冲突和来源不明的问题，现在用 composables 可以清晰地管理依赖。

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

## watchEffectとwatchの使い分け

`watchEffect` 会自动追踪函数内的响应式依赖，首次立即执行。`watch` 则需要显式指定数据源。

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

选择建议：需要获取旧值或精确控制触发条件时用 `watch`；需要自动追踪多个依赖时用 `watchEffect`。

## 生命周期钩子的映射

Composition API 中的生命周期钩子都以 `on` 开头，且只在 `setup` 中有效。

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

- Composition API 的核心是 `setup` 函数，所有逻辑从这里组织
- `ref` 用于基本类型，`reactive` 用于对象，注意 `.value` 的使用场景
- Composables 替代 mixins，解决了命名冲突和来源不明的问题
- `watchEffect` 自动追踪依赖，`watch` 显式指定且可获取旧值
- 生命周期钩子全部以 `on` 前缀命名，只能在 `setup` 中调用
