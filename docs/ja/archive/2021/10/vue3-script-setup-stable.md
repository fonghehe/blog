---
title: "Vue 3 `<script setup>` 正式リリース"
date: 2021-10-11 10:39:37
tags:
  - Vue
  - TypeScript

readingTime: 3
description: "Vue 3.2 で script setup が正式に安定機能としてマークされました。半年間の実験的サポートを経て、本番環境でも安心して使用できるようになりました。"
wordCount: 350
---

Vue 3.2 で `<script setup>` が正式に安定機能としてマークされました。半年間の実験的サポートを経て、本番環境でも安心して使用できるようになりました。

## 以前の課題

```vue
<!-- Options API：ロジックが分散 -->
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

<!-- Composition API：setup() で多くのものを return する必要がある -->
<script lang="ts">
import { ref, onMounted } from 'vue'

export default {
  setup() {
    const count = ref(0)
    const increment = () => count.value++

    onMounted(() => {
      console.log('mounted')
    })

    // 手動で return する必要があり、漏れやすい
    return { count, increment }
  }
}
</script>
```

## `<script setup>` の改善点

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

// 自動でテンプレートに公開され、return は不要
const count = ref(0)
const increment = () => count.value++

onMounted(() => {
  console.log('mounted')
})

// すべてのトップレベルバインディングが自動で利用可能
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

コード量が半分になり、ロジックがよりコンパクトになりました。

## defineProps 和 defineEmits

```vue
<script setup lang="ts">
// 型宣言方式（推奨）
const props = defineProps<{
  title: string
  count?: number
  items: string[]
}>()

// デフォルト値付き
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

`<script setup>` はデフォルトでは親コンポーネントにプロパティを公開しません（`ref` でアクセスできません）。明示的に公開する必要があります：

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
const name = ref('hello')

// count のみ公開し、name は公開しない
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

## useSlots と useAttrs

```vue
<script setup lang="ts">
import { useSlots, useAttrs } from 'vue'

const slots = useSlots()
const attrs = useAttrs()

// デフォルトスロットにコンテンツがあるか確認
const hasDefaultSlot = !!slots.default

// attrs は非リアクティブ
console.log(attrs.class)
</script>
```

## トップレベル await

```vue
<script setup lang="ts">
// async setup() は不要で、直接 await を使用
const data = await fetch('/api/user').then(r => r.json())

// Suspense と組み合わせて使用
const posts = await fetchPosts()
</script>

<template>
  <div>{{ data.name }}</div>
</template>
```

## TypeScript との深い統合

```vue
<script setup lang="ts">
interface User {
  id: number
  name: string
  role: 'admin' | 'user'
}

// Props の型は自動推論され、追加の型宣言は不要
const props = defineProps<{
  user: User
  onSelect?: (user: User) => void
}>()

// 実行時オーバーヘッドはなく、すべてコンパイル時に処理される
const emit = defineEmits<{
  (e: 'select', user: User): void
}>()
</script>
```

## 実際のコンポーネント例

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

## まとめ

- `<script setup>` は Vue 3 の推奨記法であり、テンプレートコードが減り、ロジックがより凝集される
- `defineProps` / `defineEmits` の TypeScript 型宣言方式が重要
- `defineExpose` でコンポーネントが公開するプロパティを制御し、デフォルトではすべて非表示
- トップレベル await を Suspense と組み合わせて非同期データ読み込みに使用
- Options API からの移行プロジェクトは段階的に導入可能、新規プロジェクトは最初から使用