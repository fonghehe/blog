---
title: "Vue 3 `<script setup>` RFC Explained"
date: 2021-01-18 17:44:03
tags:
  - Vue
  - TypeScript

readingTime: 3
description: "Vue 3.2 will bring the script setup syntax sugar, and its RFC is now in the final stage. This is the biggest experience upgrade for the Vue 3 Composition API — worth learning early."
wordCount: 291
---

Vue 3.2 is bringing the `<script setup>` syntax sugar, and its RFC is now in the final stage. It's the single biggest quality-of-life improvement to the Vue 3 Composition API, and worth getting to know ahead of time.

## Why `<script setup>` is Needed

First look at the current Composition API style — even a simple component needs a lot of boilerplate:

```vue
<!-- 传统 setup() 写法 -->
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

Every variable has to be declared in `return` once, and the bigger the component, the more boilerplate. `<script setup>` solves this directly:

```vue
<!-- <script setup> 写法 -->
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

// 不需要 return！顶层绑定自动暴露给模板
</script>
```

## Core Feature Analysis

**1. Top-level bindings are exposed automatically**

Top-level `import`s, `ref`s, `computed`s, and function declarations in `<script setup>` are all exposed to the template automatically — no manual `return` needed:

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

// 以上全部自动可用于模板
</script>

<template>
  <MyComponent :date="formatDate(new Date())" @click="handleClick" />
  <p>{{ message }}: {{ count }}</p>
</template>
```

**2. Components register automatically**

Components you `import` are registered automatically — no need to declare them manually in `components`:

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

**3. defineProps / defineEmits compiler macros**

Neither needs to be imported; they are compile-time macros:

```vue
<script setup>
// 运行时声明
const props = defineProps({
  msg: String,
  items: {
    type: Array,
    default: () => []
  }
})

// TypeScript 类型声明（需要开启类型支持）
// const props = defineProps<{
//   msg: string
//   items?: string[]
// }>()

const emit = defineEmits({
  // 验证器
  change: (value) => typeof value === 'string',
  submit: null // 不需要验证
})

function handleSubmit() {
  emit('submit')
}
</script>
```

**4. defineExpose for explicit exposure**

By default, `<script setup>` exposes its top-level bindings. If you need to expose specific methods of a child component:

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
  childRef.value.reset() // 类型安全
}
</script>

<template>
  <Child ref="childRef" />
</template>
```

## Working with TypeScript

TypeScript support in `<script setup>` feels natural:

```vue
<script setup lang="ts">
// Props 类型声明
interface Props {
  title: string
  count?: number
  items: Array<{ id: number; name: string }>
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  items: () => []
})

// Emits 类型声明
const emit = defineEmits<{
  (e: 'change', value: string): void
  (e: 'update:modelValue', value: number): void
}>()

// 类型推断自然流畅
function handleChange(value: string) {
  emit('change', value) // 类型检查：value 必须是 string
}
</script>
```

## Comparison in Real Projects

Before migration (Options API style):

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

After migration:

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

There's less code, and the logic is more cohesive — related state and logic live together, instead of jumping between `data`, `computed`, and `methods`.

## Summary

- `<script setup>` is syntactic sugar over the Composition API that cuts boilerplate dramatically
- Top-level bindings are exposed automatically and imported components register themselves, making the dev experience close to React Hooks
- `defineProps` / `defineEmits` / `defineExpose` are compiler macros and need no import
- TypeScript support is natural, and type inference is much better than with the Options API
- Full support is expected in Vue 3.2; you can try it now in experimental projects
