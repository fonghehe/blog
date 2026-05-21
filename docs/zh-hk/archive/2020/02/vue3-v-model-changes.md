---
title: "Vue 3 v-model 雙向綁定改進"
date: 2020-02-04 15:38:30
tags:
  - Vue
readingTime: 2
description: "Vue 3 對 `v-model` 做了重大簡化：移除了 `.sync` 修飾符，統一為 `modelValue` + `update:modelValue` 的標準模式。同時支持多個 `v-model` 綁定，解決了 Vue 2 中組件雙向綁定的諸多痛點。"
wordCount: 282
---

Vue 3 對 `v-model` 做了重大簡化：移除了 `.sync` 修飾符，統一為 `modelValue` + `update:modelValue` 的標準模式。同時支持多個 `v-model` 綁定，解決了 Vue 2 中組件雙向綁定的諸多痛點。

## Vue 2 vs Vue 3 的差異

Vue 2 中，子組件要實現雙向綁定需要通過 `value` prop 和 `$emit('input')`。如果還需要 `.sync` 同步其他屬性，又是一套不同的規則。

```vue
<!-- Vue 2 寫法 -->
<template>
  <!-- 子組件接收 value，通過 input 事件更新 -->
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ['value'] // 固定用 value
}
</script>

<!-- 父組件 -->
<!-- v-model 綁定 value + input -->
<MyInput v-model="name" />
<!-- .sync 綁定其他屬性 -->
<MyInput :title.sync="title" />
```

Vue 3 統一了規則。

```vue
<!-- Vue 3 寫法 -->
<template>
  <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
</template>

<script>
export default {
  props: ['modelValue'] // 固定用 modelValue
}
</script>

<!-- 父組件 -->
<MyInput v-model="name" />
```

## 多個 v-model 綁定

Vue 3 支持為 `v-model` 指定參數，實現一個組件多個雙向綁定。

```vue
{% raw %}
<!-- 子組件 UserForm.vue -->
<template>
  <div>
    <div class="field">
      <label>用户名</label>
      <input
        :value="username"
        @input="$emit('update:username', $event.target.value)"
      />
    </div>
    <div class="field">
      <label>郵箱</label>
      <input
        :value="email"
        @input="$emit('update:email', $event.target.value)"
      />
    </div>
    <div class="field">
      <label>備註</label>
      <textarea
        :value="note"
        @input="$emit('update:note', $event.target.value)"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    username: String,
    email: String,
    note: String
  },
  emits: ['update:username', 'update:email', 'update:note']
}
</script>

<!-- 父組件使用 -->
<template>
  <UserForm
    v-model:username="form.username"
    v-model:email="form.email"
    v-model:note="form.note"
  />
  <pre>{{ form }}</pre>
</template>

<script>
import { reactive } from 'vue'

export default {
  setup() {
    const form = reactive({
      username: '',
      email: '',
      note: ''
    })
    return { form }
  }
}
</script>
{% endraw %}
```

## 自定義 v-model 修飾符

Vue 3 允許為自定義組件的 `v-model` 傳遞修飾符。

```vue
{% raw %}
<!-- 子組件 SearchInput.vue -->
<template>
  <input
    :value="modelValue"
    @input="handleInput"
  />
</template>

<script>
export default {
  props: {
    modelValue: String,
    modelModifiers: {
      default: () => ({})
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const handleInput = (e) => {
      let value = e.target.value
      // 如果使用了 .trim 修飾符
      if (props.modelModifiers.trim) {
        value = value.trim()
      }
      // 如果使用了 .uppercase 修飾符
      if (props.modelModifiers.uppercase) {
        value = value.toUpperCase()
      }
      emit('update:modelValue', value)
    }
    return { handleInput }
  }
}
</script>

<!-- 父組件使用 -->
<template>
  <SearchInput v-model.trim.uppercase="keyword" />
  <p>當前值: {{ keyword }}</p>
</template>
{% endraw %}
```

## 使用 v-model 封裝表單組件

實際項目中最常見的場景：封裝 Select、DatePicker 等表單組件。

```vue
{% raw %}
<!-- BaseSelect.vue -->
<template>
  <div class="base-select" ref="selectRef">
    <div class="select-trigger" @click="toggle">
      <span>{{ selectedLabel || placeholder }}</span>
      <i class="arrow-down" />
    </div>
    <div v-show="visible" class="select-dropdown">
      <div
        v-for="option in options"
        :key="option.value"
        class="select-option"
        :class="{ active: option.value === modelValue }"
        @click="select(option)"
      >
        {{ option.label }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'BaseSelect',
  props: {
    modelValue: [String, Number],
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '請選擇' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const visible = ref(false)
    const toggle = () => { visible.value = !visible.value }

    const selectedLabel = computed(() => {
      const found = props.options.find(o => o.value === props.modelValue)
      return found ? found.label : ''
    })

    const select = (option) => {
      emit('update:modelValue', option.value)
      emit('change', option.value)
      visible.value = false
    }

    return { visible, toggle, selectedLabel, select }
  }
}
</script>

<!-- 使用 -->
<!-- <BaseSelect v-model="city" :options="cityOptions" /> -->
{% endraw %}
```

## 小結

- Vue 3 統一用 `modelValue` + `update:modelValue`，替代 Vue 2 的 `value` + `input`
- `.sync` 修飾符被移除，`v-model:propName` 更直觀地實現多屬性雙向綁定
- 自定義修飾符通過 `modelModifiers` prop 接收，靈活擴展行為
- 封裝表單組件時，始終遵循 props 聲明 + emits 聲明的規範
