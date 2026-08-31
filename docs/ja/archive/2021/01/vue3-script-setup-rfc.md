---
title: "Vue 3 `<script setup>` RFC 解説"
date: 2021-01-18 17:44:03
tags:
  - Vue
  - TypeScript

readingTime: 4
description: "Vue 3.2 では `<script setup>` というシンタックスシュガーが登場する（現在 RFC は最終段階）。これは Vue 3 の Composition API において体験を最も大きく向上させる機能であり、早めに知っておく価値がある。"
wordCount: 726
---

Vue 3.2 では `<script setup>` というシンタックスシュガーが登場します（現在 RFC は最終段階）。これは Vue 3 の Composition API において体験を最も大きく向上させる機能であり、早めに知っておく価値があります。

## なぜ `<script setup>` が必要か

現在の Composition API の書き方から見てみましょう。単純なコンポーネントでも大量のボイラープレートコードが必要です：

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

すべての変数を `return` で一度ずつ宣言する必要があり、コンポーネントが大きくなるほどボイラープレートが増えます。`<script setup>` はこの問題を直接解決します：

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

## コア機能の解析

**1. トップレベルのバインディングの自動公開**

`<script setup>` では、トップレベルの `import`、`ref`、`computed`、関数宣言はすべてテンプレートに自動的に公開され、手動で `return` する必要はありません：

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

**2. コンポーネントの自動登録**

`import` したコンポーネントは自動的に登録され、`components` に手動で宣言する必要はありません：

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

**3. defineProps / defineEmits コンパイルマクロ**

これらは import 不要で、コンパイル時のマクロ（compiler macro）です：

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

**4. defineExpose による明示的な公開**

デフォルトでは、`<script setup>` が公開するのはトップレベルのバインディングです。子コンポーネントの特定のメソッドを公開したい場合は：

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

## TypeScript との連携

`<script setup>` の TypeScript サポートは自然です：

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

## 実プロジェクトでの比較

移行前（Options API スタイル）：

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

コード量が減り、ロジックも集約されます——関連する状態とロジックが一か所にまとまり、`data`、`computed`、`methods` の間を飛び回る必要がなくなります。

## まとめ

- `<script setup>` は Composition API のシンタックスシュガーであり、ボイラープレートを大幅に削減する
- トップレベルのバインディングは自動的に公開され、コンポーネントの import は自動登録されるため、開発体験は React Hooks に近い
- `defineProps` / `defineEmits` / `defineExpose` はコンパイル時のマクロであり、import は不要だ
- TypeScript のサポートは自然で、型推論は Options API よりもはるかに優れている
- Vue 3.2 での正式サポートが予定されており、今は実験的なプロジェクトで先行して試すことができる
