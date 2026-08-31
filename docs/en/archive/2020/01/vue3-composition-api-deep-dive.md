---
title: "Vue 3 Composition API Deep Dive:  Options  to  Composition Migration"
date: 2020-01-01 15:25:34
tags:
  - Vue
readingTime: 2
description: "Vue 3's Composition API is the most significant paradigm shift since Vue was created. For developers used to the Options API the learning curve isn't steep, but truly mastering it requires understanding its design philosophy and underlying mechanisms. This article breaks down the core usage from a practical engineering perspective."
wordCount: 295
---

Vue 3's Composition API is the most significant paradigm shift since Vue was created. For developers used to the Options API, the learning curve isn't steep, but to truly use it well you need to understand its design philosophy and underlying mechanisms. This article breaks down the core usage of the Composition API from a practical engineering perspective.

## The setup Function and Reactivity Basics

The `setup` function is the entry point of the Composition API. It runs before the component is created and receives two arguments: `props` and `context`. All reactive state, computed properties, and methods are defined here.

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

Note that a `ref`'s value is accessed via `.value` in JavaScript but is automatically unwrapped in templates. This is a common pitfall for beginners.

## Custom Reusable Logic

The most powerful aspect of the Composition API is logic reuse. In the past, mixins caused naming conflicts and unclear source-of-truth issues; now composables let you manage dependencies clearly.

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

## Choosing Between watchEffect and watch

`watchEffect` automatically tracks the reactive dependencies inside the function and runs immediately on first call. `watch` requires you to specify the data source explicitly.

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

Rule of thumb: use `watch` when you need the old value or precise control over triggers; use `watchEffect` when you need to automatically track multiple dependencies.

## Lifecycle Hook Mapping

Lifecycle hooks in the Composition API all start with `on` and are only valid inside `setup`.

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

## Summary

- The core of the Composition API is the `setup` function, where all logic is organized.
- Use `ref` for primitives and `reactive` for objects; mind where `.value` is needed.
- Composables replace mixins, solving the naming-conflict and unclear-source problems.
- `watchEffect` tracks dependencies automatically, while `watch` is explicit and can access the old value.
- All lifecycle hooks are prefixed with `on` and can only be called inside `setup`.
