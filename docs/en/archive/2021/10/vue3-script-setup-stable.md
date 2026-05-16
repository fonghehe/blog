---
title: "Vue 3 `<script setup>` Official Release"
date: 2021-10-11 10:39:37
tags:
  - Vue
  - TypeScript

readingTime: 2
description: "Vue 3.2 正式将 `<script setup>` 标记为稳定特性。用了半年实验性支持，现在可以放心在生产环境用了。"
---

Vue 3.2 正式将 `<script setup>` 标记为稳定特性。用了半年实验性支持，现在可以放心在生产环境用了。

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

## `<script setup>` 的改进

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

代码量减半，逻辑更紧凑。

## defineProps 和 defineEmits

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

`<script setup>` 默认不暴露任何属性给父组件（`ref` 访问不到）。需要显式暴露：

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

## useSlots 和 useAttrs

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

- `<script setup>` 是 Vue 3 的推荐写法，减少模板代码，逻辑更内聚
- `defineProps` / `defineEmits` 的 TypeScript 类型声明方式是重点
- `defineExpose` 控制组件暴露的属性，默认全部隐藏
- 顶层 await 配合 Suspense 做异步数据加载
- 从 Options API 迁移的项目可以逐步引入，新项目直接用