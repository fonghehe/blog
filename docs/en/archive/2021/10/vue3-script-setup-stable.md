---
title: "Vue 3 `<script setup>` Official Release"
date: 2021-10-11 10:39:37
tags:
  - Vue
  - TypeScript

readingTime: 2
description: "Vue 3.2 officially marks script setup as stable. After six months on experimental support, it's now safe to use in production."
wordCount: 158
---

Vue 3.2 has officially marked `<script setup>` as a stable feature. After half a year of experimental support, it's now safe to use in production.

## Previous Pain Points

```vue
<!-- Options API：逻辑分散 -->
<script>
export default {
  data() {
    return { count: 0 }
  },
  methods: {
    increment() {
      this.count++
    }
  },
  mounted() {
    console.log('mounted')
  }
}
</script>

<!-- Composition API：setup() 里要 return 很多东西 -->
<script lang="ts">
import { ref, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => count.value++

    onMounted(() => {
      console.log('mounted')
    })

    // 必须手动 return，容易漏
    return { count, increment }
  }
}
</script>
```

## Improvements in `<script setup>`

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 自动暴露给模板，不需要 return
const count = ref(0)
const increment = () => count.value++

onMounted(() => {
  console.log('mounted')
})

// 所有顶层绑定自动可用
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

The amount of code is cut roughly in half, and the logic is more compact.

## defineProps and defineEmits

```vue
<script setup lang="ts">
// 类型声明方式（推荐）
const props = defineProps<{
  title: string
  count?: number
  items: string[]
}>()

// 带默认值
const props = withDefaults(defineProps<{
  title: string
  count?: number
}>(), {
  count: 0,
})

// defineEmits
const emit = defineEmits<{
  (e: 'update', value: string): void
  (e: 'delete', id: number): void
}>()

// 使用
function handleUpdate(val: string) {
  emit('update', val)
}
</script>
```

## defineExpose

By default, `<script setup>` exposes no properties to the parent component (they can't be accessed via `ref`). You need to expose them explicitly:

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
const name = ref('hello')

// 只暴露 count，不暴露 name
defineExpose({ count })
</script>

<!-- 父组件 -->
<script setup>
const childRef = ref()

onMounted(() => {
  console.log(childRef.value.count) // ✅
  console.log(childRef.value.name)  // ❌ undefined
})
</script>
```

## useSlots and useAttrs

```vue
<script setup lang="ts">
import { useSlots, useAttrs } from 'vue'

const slots = useSlots()
const attrs = useAttrs()

// 检查是否有默认插槽内容
const hasDefaultSlot = !!slots.default

// attrs 是非响应式的
console.log(attrs.class)
</script>
```

## Top-Level await

```vue
<script setup lang="ts">
// 不需要 async setup()，直接 await
const data = await fetch('/api/user').then(r => r.json())

// 结合 Suspense 使用
const posts = await fetchPosts()
</script>

<template>
  <div>{{ data.name }}</div>
</template>
```

## Deep TypeScript Integration

```vue
<script setup lang="ts">
interface User {
  id: number
  name: string
  role: 'admin' | 'user'
}

// Props 类型自动推断，不需要额外的类型声明
const props = defineProps<{
  user: User
  onSelect?: (user: User) => void
}>()

// 没有运行时开销，编译时全部处理
const emit = defineEmits<{
  (e: 'select', user: User): void
}>()
</script>
```

## Real Component Examples

```vue
<!-- components/DataTable.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

interface Column<T = any> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: T[keyof T], row: T) => string
}

const props = withDefaults(defineProps<{
  columns: Column[]
  data: any[]
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  (e: 'sort', key: string, direction: 'asc' | 'desc'): void
  (e: 'row-click', row: any): void
}>()

const sortKey = ref<string | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function handleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
  emit('sort', key, sortDir.value)
}
</script>

<template>
  <div v-if="loading" class="animate-pulse">加载中...</div>
  <table v-else>
    <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="String(col.key)"
          :class="{ 'cursor-pointer': col.sortable }"
          @click="col.sortable && handleSort(String(col.key))"
        >
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, index) in data"
        :key="index"
        @click="emit('row-click', row)"
      >
        <td v-for="col in columns" :key="String(col.key)">
          {{ col.render ? col.render(row[col.key], row) : row[col.key] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

## Summary

- `<script setup>` is the recommended way to write Vue 3 — it reduces boilerplate and keeps logic more cohesive
- The TypeScript type-declaration style of `defineProps` / `defineEmits` is the key part
- `defineExpose` controls which properties a component exposes; by default they are all hidden
- Top-level await works with Suspense for asynchronous data loading
- Projects migrating from the Options API can adopt it gradually, while new projects can use it from the start