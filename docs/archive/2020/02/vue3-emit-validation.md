---
title: "Vue 3 事件发射与验证"
date: 2020-02-11 11:19:41
tags:
  - Vue
---

Vue 3 要求显式声明组件发出的事件，这不仅是最佳实践，更是一种强制约束。配合 TypeScript 的类型推导，可以在编译期就捕获大部分事件相关的 bug。本文从 emit 的底层机制讲起，整理事件设计的最佳实践。

## emits 选项与事件验证

Vue 3 新增 `emits` 选项，要求声明组件会触发的所有事件。

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

当验证函数返回 `false` 时，控制台会打印警告信息，但不会阻止事件触发。这适合开发环境排查问题。

## 事件命名规范

Vue 3 的模板编译器会自动将事件名从 camelCase 转为 kebab-case。

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

团队中统一约定：emit 名称用 camelCase 声明，模板中用 kebab-case 监听。

## 带返回值的 emit 模式

有时子组件发出事件后需要父组件返回结果，可以用 Promise 包装。

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

## Composition API 中的 emit 模式

在 `setup` 函数中通过 `context.emit` 发射事件，配合 TypeScript 类型更佳。

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

## 小结

- `emits` 选项让组件的对外接口更透明，开发环境下支持参数验证
- 事件名在模板中自动转 kebab-case，团队统一约定模板写 kebab-case
- 使用对象语法声明 emits 可以做参数类型校验，返回 false 会触发控制台警告
- 在 composables 中通过 `emit` 参数传递事件触发能力，保持逻辑复用的灵活性
