---
title: "Vue 3 `<script setup>` RFC 解讀"
date: 2021-01-18 17:44:03
tags:
  - Vue
  - React
  - TypeScript
readingTime: 3
description: "Vue 3.2 即將帶來 `<script setup>` 語法糖，目前 RFC 已經進入最終階段。這是 Vue 3 Composition API 體驗提升最大的一個特性，值得提前瞭解。"
---

Vue 3.2 即將帶來 `<script setup>` 語法糖，目前 RFC 已經進入最終階段。這是 Vue 3 Composition API 體驗提升最大的一個特性，值得提前瞭解。

## 為什麼需要 `<script setup>`

先看當前 Composition API 的寫法，一個簡單的組件需要大量樣板代碼：

```vue
<!-- 傳統 setup() 寫法 -->
<script>
import { ref, computed, defineComponent } from 'vue'

export default defineComponent({
  props: {
    title: String,
    count: Number
  },
  emits: ['update:count'],
  setup(props, { emit }) {
    const doubled = computed(() => props.count * 2)

    function increment() {
      emit('update:count', props.count + 1)
    }

    return {
      doubled,
      increment
    }
  }
})
</script>
```

每個變量都要在 `return` 裏聲明一次，組件越大樣板越多。`<script setup>` 直接解決了這個問題：

```vue
<!-- <script setup> 寫法 -->
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: String,
  count: Number
})

const emit = defineEmits(['update:count'])

const doubled = computed(() => props.count * 2)

function increment() {
  emit('update:count', props.count + 1)
}

// 不需要 return！頂層綁定自動暴露給模板
</script>
```

## 核心特性解析

**1. 頂層綁定自動暴露**

`<script setup>` 中的頂層 `import`、`ref`、`computed`、函數聲明都會自動暴露給模板，不需要手動 `return`：

```vue
<script setup>
import { ref } from 'vue'
import MyComponent from './MyComponent.vue'
import { formatDate } from '../utils'

const count = ref(0)
const message = ref('hello')

function handleClick() {
  count.value++
}

// 以上全部自動可用於模板
</script>

<template>
  <MyComponent :date="formatDate(new Date())" @click="handleClick" />
  <p>{{ message }}: {{ count }}</p>
</template>
```

**2. 組件自動註冊**

`import` 進來的組件自動註冊，不需要在 `components` 裏手動聲明：

```vue
<script setup>
// 直接 import 就能在模板中使用
import DatePicker from './DatePicker.vue'
import Dialog from './Dialog.vue'
import Button from './Button.vue'
</script>

<template>
  <!-- 不需要 components: { DatePicker, Dialog, Button } -->
  <DatePicker />
  <Dialog />
  <Button />
</template>
```

**3. defineProps / defineEmits 編譯宏**

這兩個不需要 import，是編譯時宏（compiler macro）：

```vue
<script setup>
// 運行時聲明
const props = defineProps({
  msg: String,
  items: {
    type: Array,
    default: () => []
  }
})

// TypeScript 類型聲明（需要開啓類型支持）
// const props = defineProps<{
//   msg: string
//   items?: string[]
// }>()

const emit = defineEmits({
  // 驗證器
  change: (value) => typeof value === 'string',
  submit: null // 不需要驗證
})

function handleSubmit() {
  emit('submit')
}
</script>
```

**4. defineExpose 顯式暴露**

默認情況下，`<script setup>` 暴露的是頂層綁定。如果需要暴露子組件的特定方法：

```vue
<!-- Child.vue -->
<script setup>
import { ref } from 'vue'

const count = ref(0)
const internalState = ref('secret')

function reset() {
  count.value = 0
}

// 只暴露 reset 和 count，不暴露 internalState
defineExpose({ reset, count })
</script>
```

```vue
<!-- Parent.vue -->
<script setup>
import { ref } from 'vue'
import Child from './Child.vue'

const childRef = ref(null)

function handleReset() {
  childRef.value.reset() // 類型安全
}
</script>

<template>
  <Child ref="childRef" />
</template>
```

## 和 TypeScript 的配合

`<script setup>` 對 TypeScript 的支持很自然：

```vue
<script setup lang="ts">
// Props 類型聲明
interface Props {
  title: string
  count?: number
  items: Array<{ id: number; name: string }>
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  items: () => []
})

// Emits 類型聲明
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update:modelValue', value: number): void
}>()

// 類型推斷自然流暢
function handleChange(value: string) {
  emit('change', value) // 類型檢查：value 必須是 string
}
</script>
```

## 實際項目中的對比

遷移前（Options API 風格）：

```vue
<script>
export default {
  props: ['userId'],
  data() {
    return { user: null, loading: false }
  },
  async created() {
    this.loading = true
    this.user = await fetchUser(this.userId)
    this.loading = false
  },
  computed: {
    displayName() {
      return this.user?.name ?? 'Unknown'
    }
  }
}
</script>
```

遷移後：

```vue
<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({ userId: String })
const user = ref(null)
const loading = ref(false)

const displayName = computed(() => user.value?.name ?? 'Unknown')

onMounted(async () => {
  loading.value = true
  user.value = await fetchUser(props.userId)
  loading.value = false
})
</script>
```

代碼量減少了，邏輯也更聚合——相關的狀態和邏輯在一起，不用在 `data`、`computed`、`methods` 之間跳來跳去。

## 小結

- `<script setup>` 是 Composition API 的語法糖，大幅減少樣板代碼
- 頂層綁定自動暴露，組件 import 自動註冊，開發體驗接近 React Hooks
- `defineProps` / `defineEmits` / `defineExpose` 是編譯宏，不需要 import
- TypeScript 支持自然，類型推斷比 Options API 好很多
- 預計 Vue 3.2 正式支持，現在可以先在實驗性項目中試用
