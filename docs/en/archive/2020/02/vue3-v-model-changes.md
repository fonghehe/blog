---
title: "Vue 3 v-model Two-Way Binding Improvements"
date: 2020-02-04 15:38:30
tags:
  - Vue
readingTime: 2
description: "Vue 3 greatly simplified `v-model` by removing the `.sync` modifier and unifying everything into the `modelValue` + `update:modelValue` pattern. It also supports multiple `v-model` bindings, solving many two-way binding pain points from Vue 2."
wordCount: 187
---

Vue 3 made a big simplification to `v-model`: it removed the `.sync` modifier and unified everything into the `modelValue` + `update:modelValue` standard. It also supports multiple `v-model` bindings, solving many of the pain points of two-way binding in Vue 2 components.

## Vue 2 vs Vue 3 Differences

In Vue 2, a child component achieved two-way binding through the `value` prop and `$emit('input')`. If you also needed `.sync` to sync other properties, that was a whole different set of rules.

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

Vue 3 unifies the rules.

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

## Multiple v-model Bindings

Vue 3 lets you pass an argument to `v-model`, enabling multiple two-way bindings on a single component.

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

## Custom v-model Modifiers

Vue 3 lets you pass modifiers to a custom component's `v-model`.

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

## Wrapping Form Components with v-model

The most common scenario in real projects: wrapping form components like Select and DatePicker.

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

## Summary

- Vue 3 standardizes on `modelValue` + `update:modelValue`, replacing Vue 2's `value` + `input`
- The `.sync` modifier is gone; `v-model:propName` makes multi-property two-way binding more intuitive
- Custom modifiers are received through the `modelModifiers` prop, flexibly extending behavior
- When wrapping form components, always follow the props declaration + emits declaration convention
