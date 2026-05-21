---
title: "Vue 3 の v-model 双方向バインディング改善"
date: 2020-02-04 15:38:30
tags:
  - Vue
readingTime: 2
description: "Vue 3 对 `v-model` 做了重大简化：移除了 `.sync` 修饰符，统一为 `modelValue` + `update:modelValue` 的标准模式。同时支持多个 `v-model` 绑定，解决了 Vue 2 中组件双向绑定的诸多痛点。"
wordCount: 288
---

Vue 3 对 `v-model` 做了重大简化：移除了 `.sync` 修饰符，统一为 `modelValue` + `update:modelValue` 的标准模式。同时支持多个 `v-model` 绑定，解决了 Vue 2 中组件双向绑定的诸多痛点。

## Vue 2とVue 3の違い

Vue 2 中，子组件要实现双向绑定需要通过 `value` prop 和 `$emit('input')`。如果还需要 `.sync` 同步其他属性，又是一套不同的规则。

```vue
<!-- Vue 2 写法 -->
<template>
  <!-- 子组件接收 value，通过 input 事件更新 -->
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ['value'] // 固定用 value
}
</script>

<!-- 父组件 -->
<!-- v-model 绑定 value + input -->
<MyInput v-model="name" />
<!-- .sync 绑定其他属性 -->
<MyInput :title.sync="title" />
```

Vue 3 统一了规则。

```vue
<!-- Vue 3 写法 -->
<template>
  <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
</template>

<script>
export default {
  props: ['modelValue'] // 固定用 modelValue
}
</script>

<!-- 父组件 -->
<MyInput v-model="name" />
```

## 複数のv-modelバインディング

Vue 3 支持为 `v-model` 指定参数，实现一个组件多个双向绑定。

```vue
{% raw %}
<!-- 子组件 UserForm.vue -->
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
      <label>邮箱</label>
      <input
        :value="email"
        @input="$emit('update:email', $event.target.value)"
      />
    </div>
    <div class="field">
      <label>备注</label>
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

<!-- 父组件使用 -->
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

## 自定义 v-model 修饰符

Vue 3 允许为自定义组件的 `v-model` 传递修饰符。

```vue
{% raw %}
<!-- 子组件 SearchInput.vue -->
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
      // 如果使用了 .trim 修饰符
      if (props.modelModifiers.trim) {
        value = value.trim()
      }
      // 如果使用了 .uppercase 修饰符
      if (props.modelModifiers.uppercase) {
        value = value.toUpperCase()
      }
      emit('update:modelValue', value)
    }
    return { handleInput }
  }
}
</script>

<!-- 父组件使用 -->
<template>
  <SearchInput v-model.trim.uppercase="keyword" />
  <p>当前值: {{ keyword }}</p>
</template>
{% endraw %}
```

## 使用 v-model 封装表单组件

实际项目中最常见的场景：封装 Select、DatePicker 等表单组件。

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
    placeholder: { type: String, default: '请选择' }
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

## まとめ

- Vue 3 统一用 `modelValue` + `update:modelValue`，替代 Vue 2 的 `value` + `input`
- `.sync` 修饰符被移除，`v-model:propName` 更直观地实现多属性双向绑定
- 自定义修饰符通过 `modelModifiers` prop 接收，灵活扩展行为
- 封装表单组件时，始终遵循 props 声明 + emits 声明的规范
