---
title: "Vue 3 `<script setup>` RFC Explained"
date: 2021-01-18 17:44:03
tags:
  - Vue
  - TypeScript

readingTime: 3
description: "Vue 3.2 即将带来 `<script setup>` 语法糖，目前 RFC 已经进入最终阶段。这是 Vue 3 Composition API 体验提升最大的一个特性，值得提前了解。"
---

Vue 3.2 即将带来 `<script setup>` 语法糖，目前 RFC 已经进入最终阶段。这是 Vue 3 Composition API 体验提升最大的一个特性，值得提前了解。

## Why `<script setup>` is Needed

先看当前 Composition API 的写法，一个简单的组件需要大量样板代码：

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

每个变量都要在 `return` 里声明一次，组件越大样板越多。`<script setup>` 直接解决了这个问题：

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

**1. 顶层绑定自动暴露**

`<script setup>` 中的顶层 `import`、`ref`、`computed`、函数声明都会自动暴露给模板，不需要手动 `return`：

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

**2. 组件自动注册**

`import` 进来的组件自动注册，不需要在 `components` 里手动声明：

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

**3. defineProps / defineEmits 编译宏**

这两个不需要 import，是编译时宏（compiler macro）：

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

**4. defineExpose 显式暴露**

默认情况下，`<script setup>` 暴露的是顶层绑定。如果需要暴露子组件的特定方法：

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

`<script setup>` 对 TypeScript 的支持很自然：

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

迁移前（Options API 风格）：

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

迁移后：

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

代码量减少了，逻辑也更聚合——相关的状态和逻辑在一起，不用在 `data`、`computed`、`methods` 之间跳来跳去。

## Summary

- `<script setup>` 是 Composition API 的语法糖，大幅减少样板代码
- 顶层绑定自动暴露，组件 import 自动注册，开发体验接近 React Hooks
- `defineProps` / `defineEmits` / `defineExpose` 是编译宏，不需要 import
- TypeScript 支持自然，类型推断比 Options API 好很多
- 预计 Vue 3.2 正式支持，现在可以先在实验性项目中试用
