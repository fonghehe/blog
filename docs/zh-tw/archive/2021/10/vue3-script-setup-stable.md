---
title: "Vue 3 `<script setup>` 正式釋出"
date: 2021-10-11 10:39:37
tags:
  - Vue
  - TypeScript
readingTime: 2
description: "Vue 3.2 正式將 `<script setup>` 標記為穩定特性。用了半年實驗性支援，現在可以放心在生產環境用了。"
---

Vue 3.2 正式將 `<script setup>` 標記為穩定特性。用了半年實驗性支援，現在可以放心在生產環境用了。

## 之前的痛點

```vue
<!-- Options API：邏輯分散 -->
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

<!-- Composition API：setup() 裡要 return 很多東西 -->
<script lang="ts">
import { ref, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => count.value++

    onMounted(() => {
      console.log('mounted')
    })

    // 必須手動 return，容易漏
    return { count, increment }
  }
}
</script>
```

## `<script setup>` 的改進

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 自動暴露給模板，不需要 return
const count = ref(0)
const increment = () => count.value++

onMounted(() => {
  console.log('mounted')
})

// 所有頂層繫結自動可用
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

程式碼量減半，邏輯更緊湊。

## defineProps 和 defineEmits

```vue
<script setup lang="ts">
// 型別宣告方式（推薦）
const props = defineProps<{
  title: string
  count?: number
  items: string[]
}>()

// 帶預設值
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

`<script setup>` 預設不暴露任何屬性給父元件（`ref` 訪問不到）。需要顯式暴露：

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
const name = ref('hello')

// 只暴露 count，不暴露 name
defineExpose({ count })
</script>

<!-- 父元件 -->
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

// 檢查是否有預設插槽內容
const hasDefaultSlot = !!slots.default

// attrs 是非響應式的
console.log(attrs.class)
</script>
```

## 頂層 await

```vue
<script setup lang="ts">
// 不需要 async setup()，直接 await
const data = await fetch('/api/user').then(r => r.json())

// 結合 Suspense 使用
const posts = await fetchPosts()
</script>

<template>
  <div>{{ data.name }}</div>
</template>
```

## 和 TypeScript 深度整合

```vue
<script setup lang="ts">
interface User {
  id: number
  name: string
  role: 'admin' | 'user'
}

// Props 型別自動推斷，不需要額外的型別宣告
const props = defineProps<{
  user: User
  onSelect?: (user: User) => void
}>()

// 沒有執行時開銷，編譯時全部處理
const emit = defineEmits<{
  (e: 'select', user: User): void
}>()
</script>
```

## 實際元件示例

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
  <div v-if="loading" class="animate-pulse">載入中...</div>
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

## 小結

- `<script setup>` 是 Vue 3 的推薦寫法，減少模板程式碼，邏輯更內聚
- `defineProps` / `defineEmits` 的 TypeScript 型別宣告方式是重點
- `defineExpose` 控制組件暴露的屬性，預設全部隱藏
- 頂層 await 配合 Suspense 做非同步資料載入
- 從 Options API 遷移的專案可以逐步引入，新專案直接用