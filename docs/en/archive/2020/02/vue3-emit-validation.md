---
title: "Vue 3 Event Emission and Validation"
date: 2020-02-11 11:19:41
tags:
  - Vue
readingTime: 3
description: "Vue 3 requires explicit declaration of emitted events—this isn't just best practice, it's a hard constraint. Combined with TypeScript's type inference, most event-related bugs can be caught at compile time. Starting from how emit works under the hood, this article lays out best practices for event design."
wordCount: 249
---

Vue 3 requires you to explicitly declare the events a component emits — this isn't just a best practice, it's a hard constraint. Combined with TypeScript's type inference, most event-related bugs can be caught at compile time. Starting from how `emit` works under the hood, this article lays out best practices for event design.

## The emits Option and Event Validation

Vue 3 added the `emits` option, which requires you to declare every event the component can fire.

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

When the validation function returns `false`, a warning is printed to the console, but the event is still emitted. This is handy for spotting issues in development.

## Event Naming Conventions

Vue 3's template compiler automatically converts event names from camelCase to kebab-case.

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

Our team convention: declare emit names in camelCase and listen for them with kebab-case in templates.

## The Emit Pattern with a Return Value

Sometimes a child component needs a result back from the parent after emitting an event; you can wrap it in a Promise.

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

## The emit Pattern in the Composition API

Inside `setup`, emit events through `context.emit`; it works even better with TypeScript types.

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

## Summary

- The `emits` option makes a component's public interface more transparent, and supports parameter validation in development
- Event names are auto-converted to kebab-case in templates, so our team standardizes on kebab-case in templates
- Declaring emits with object syntax lets you validate parameter types; returning `false` triggers a console warning
- In composables, pass the emit capability through an `emit` argument to keep your reusable logic flexible
