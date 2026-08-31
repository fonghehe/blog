---
title: "Vue 3 のイベント送出とバリデーション"
date: 2020-02-11 11:19:41
tags:
  - Vue
readingTime: 4
description: "Vue 3 ではコンポーネントが発行するイベントの明示的な宣言が求められる。これはベストプラクティスであるだけでなく、強制的な制約でもある。TypeScript の型推論と組み合わせれば、コンパイル時にイベント関連のバグの多くを捕捉できる。本記事では emit の内部仕組みから出発し、イベント設計のベストプラクティスを整理する。"
wordCount: 649
---

Vue 3 では、コンポーネントが発行するイベントを明示的に宣言することが求められる。これは単なるベストプラクティスではなく、強制的な制約でもある。TypeScript の型推論と組み合わせれば、コンパイル時にイベント関連のバグの多くを捕捉できる。本記事では emit の仕組みから出発し、イベント設計のベストプラクティスを整理する。

## emitsオプションとイベントバリデーション

Vue 3 では `emits` オプションが追加され、コンポーネントが発行する全てのイベントの宣言が求められる。

```vue
{% raw %}
<template>
  <div class="pagination">
    <button :disabled="currentPage <= 1" @click="prev">上一页</button>
    <span>{{ currentPage }} / {{ totalPages }}</span>
    <button :disabled="currentPage >= totalPages" @click="next">下一页</button>
  </div>
</template>

<script>
export default {
  props: {
    currentPage: { type: Number, required: true },
    totalPages: { type: Number, required: true }
  },

  // 声明事件，支持对象语法做参数验证
  emits: {
    'update:currentPage': (page) => {
      if (typeof page !== 'number') {
        console.warn('update:currentPage 的参数应为 number 类型')
        return false
      }
      if (page < 1) {
        console.warn('页码不能小于 1')
        return false
      }
      return true
    },
    // 简单写法：只声明，不验证
    'page-change': null
  },

  setup(props, { emit }) {
    const prev = () => {
      const page = props.currentPage - 1
      emit('update:currentPage', page)
      emit('page-change', page)
    }

    const next = () => {
      const page = props.currentPage + 1
      emit('update:currentPage', page)
      emit('page-change', page)
    }

    return { prev, next }
  }
}
</script>
{% endraw %}
```

検証関数が `false` を返した場合、コンソールに警告が出力されるが、イベントの発行はブロックされない。開発環境での問題切り分けに適している。

## イベント命名の規約

Vue 3 のテンプレートコンパイラは、イベント名を camelCase から kebab-case へ自動変換する。

```vue
<script>
export default {
  // 声明用 camelCase
  emits: ['itemSelected', 'statusChanged', 'formSubmitted'],
  methods: {
    select(item) {
      // JS 中用 camelCase
      this.$emit('itemSelected', item)
    }
  }
}
</script>

<!-- 模板中两种写法都可以 -->
<!-- <Child @itemSelected="handleSelect" /> -->
<!-- <Child @item-selected="handleSelect" /> -->
```

チーム内の統一ルールとして、emit 名は camelCase で宣言し、テンプレートでは kebab-case で監視する。

## 戻り値付き emit パターン

子コンポーネントがイベントを発行した後、親コンポーネントから結果を返してもらう必要がある場合は、Promise で包むことができる。

```vue
{% raw %}
<!-- 子组件 ConfirmDialog.vue -->
<template>
  <div class="confirm-dialog">
    <p>{{ message }}</p>
    <button @click="confirm">确定</button>
    <button @click="cancel">取消</button>
  </div>
</template>

<script>
export default {
  props: {
    message: { type: String, default: '确认操作？' }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const confirm = () => {
      emit('confirm')
    }
    const cancel = () => {
      emit('cancel')
    }
    return { confirm, cancel }
  }
}
</script>

<!-- 父组件 -->
<template>
  <ConfirmDialog
    v-if="showConfirm"
    message="确定删除这条记录？"
    @confirm="handleConfirm"
    @cancel="showConfirm = false"
  />
</template>

<script>
export default {
  setup() {
    const showConfirm = ref(false)

    const handleConfirm = async () => {
      // 业务逻辑放在这里
      await deleteRecord(recordId)
      showConfirm.value = false
    }

    return { showConfirm, handleConfirm }
  }
}
</script>
{% endraw %}
```

## Composition API における emit パターン

`setup` 関数内では `context.emit` を通じてイベントを発行し、TypeScript の型と組み合わせるとより良い。

```javascript
// composables/useForm.js
import { ref, computed } from 'vue'

export function useForm(initialValues, emit) {
  const form = ref({ ...initialValues })
  const errors = ref({})
  const submitting = ref(false)

  const isValid = computed(() => {
    return Object.keys(errors.value).length === 0
  })

  const validate = (rules) => {
    const newErrors = {}
    for (const [field, rule] of Object.entries(rules)) {
      const value = form.value[field]
      if (rule.required && !value) {
        newErrors[field] = `${field} 不能为空`
      }
      if (rule.minLength && value.length < rule.minLength) {
        newErrors[field] = `${field} 最少 ${rule.minLength} 个字符`
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        newErrors[field] = rule.message || `${field} 格式不正确`
      }
    }
    errors.value = newErrors
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!isValid.value) return
    submitting.value = true
    emit('submit', form.value)
    submitting.value = false
  }

  const handleReset = () => {
    form.value = { ...initialValues }
    errors.value = {}
    emit('reset')
  }

  return { form, errors, submitting, isValid, validate, handleSubmit, handleReset }
}

// 组件中使用
export default {
  emits: ['submit', 'reset'],
  setup(props, { emit }) {
    const { form, errors, submitting, validate, handleSubmit, handleReset } = useForm(
      { username: '', password: '' },
      emit
    )

    return { form, errors, submitting, validate, handleSubmit, handleReset }
  }
}
```

## まとめ

- `emits` オプションによりコンポーネントの外部インターフェースがより透明になり、開発環境ではパラメータ検証もサポートされる
- イベント名はテンプレート内で自動的に kebab-case に変換されるため、チーム統一でテンプレート側は kebab-case とする
- オブジェクト構文で emits を宣言するとパラメータの型検証が可能で、false を返すとコンソールに警告が出る
- composables 内で `emit` パラメータを通じてイベント発行機能を渡し、ロジック再利用の柔軟性を保つ
