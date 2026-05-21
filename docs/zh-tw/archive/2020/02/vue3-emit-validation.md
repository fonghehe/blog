---
title: "Vue 3 事件發射與驗證"
date: 2020-02-11 11:19:41
tags:
  - Vue
readingTime: 3
description: "Vue 3 要求顯式宣告元件發出的事件，這不僅是最佳實踐，更是一種強制約束。配合 TypeScript 的型別推導，可以在編譯期就捕獲大部分事件相關的 bug。本文從 emit 的底層機制講起，整理事件設計的最佳實踐。"
wordCount: 370
---

Vue 3 要求顯式宣告元件發出的事件，這不僅是最佳實踐，更是一種強制約束。配合 TypeScript 的型別推導，可以在編譯期就捕獲大部分事件相關的 bug。本文從 emit 的底層機制講起，整理事件設計的最佳實踐。

## emits 選項與事件驗證

Vue 3 新增 `emits` 選項，要求宣告元件會觸發的所有事件。

```vue
{% raw %}
<template>
  <div class="pagination">
    <button :disabled="currentPage <= 1" @click="prev">上一頁</button>
    <span>{{ currentPage }} / {{ totalPages }}</span>
    <button :disabled="currentPage >= totalPages" @click="next">下一頁</button>
  </div>
</template>

<script>
export default {
  props: {
    currentPage: { type: Number, required: true },
    totalPages: { type: Number, required: true }
  },

  // 宣告事件，支援物件語法做引數驗證
  emits: {
    'update:currentPage': (page) => {
      if (typeof page !== 'number') {
        console.warn('update:currentPage 的引數應為 number 型別')
        return false
      }
      if (page < 1) {
        console.warn('頁碼不能小於 1')
        return false
      }
      return true
    },
    // 簡單寫法：只宣告，不驗證
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

當驗證函式返回 `false` 時，控制台會列印警告資訊，但不會阻止事件觸發。這適合開發環境排查問題。

## 事件命名規範

Vue 3 的模板編譯器會自動將事件名從 camelCase 轉為 kebab-case。

```vue
<script>
export default {
  // 宣告用 camelCase
  emits: ['itemSelected', 'statusChanged', 'formSubmitted'],
  methods: {
    select(item) {
      // JS 中用 camelCase
      this.$emit('itemSelected', item)
    }
  }
}
</script>

<!-- 模板中兩種寫法都可以 -->
<!-- <Child @itemSelected="handleSelect" /> -->
<!-- <Child @item-selected="handleSelect" /> -->
```

團隊中統一約定：emit 名稱用 camelCase 宣告，模板中用 kebab-case 監聽。

## 帶返回值的 emit 模式

有時子元件發出事件後需要父元件返回結果，可以用 Promise 包裝。

```vue
{% raw %}
<!-- 子元件 ConfirmDialog.vue -->
<template>
  <div class="confirm-dialog">
    <p>{{ message }}</p>
    <button @click="confirm">確定</button>
    <button @click="cancel">取消</button>
  </div>
</template>

<script>
export default {
  props: {
    message: { type: String, default: '確認操作？' }
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

<!-- 父元件 -->
<template>
  <ConfirmDialog
    v-if="showConfirm"
    message="確定刪除這條記錄？"
    @confirm="handleConfirm"
    @cancel="showConfirm = false"
  />
</template>

<script>
export default {
  setup() {
    const showConfirm = ref(false)

    const handleConfirm = async () => {
      // 業務邏輯放在這裡
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

在 `setup` 函式中通過 `context.emit` 發射事件，配合 TypeScript 型別更佳。

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
        newErrors[field] = `${field} 不能為空`
      }
      if (rule.minLength && value.length < rule.minLength) {
        newErrors[field] = `${field} 最少 ${rule.minLength} 個字元`
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        newErrors[field] = rule.message || `${field} 格式不正確`
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

// 元件中使用
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

## 小結

- `emits` 選項讓元件的對外介面更透明，開發環境下支援引數驗證
- 事件名在模板中自動轉 kebab-case，團隊統一約定模板寫 kebab-case
- 使用物件語法宣告 emits 可以做引數型別校驗，返回 false 會觸發控制台警告
- 在 composables 中通過 `emit` 引數傳遞事件觸發能力，保持邏輯複用的靈活性
