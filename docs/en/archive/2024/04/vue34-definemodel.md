---
title: "Vue 3.4: defineModel and v-bind Shorthand"
date: 2024-04-12 16:06:12
tags:
  - Vue
readingTime: 1
description: "Vue 3.4 released several high-quality improvements, most notably `defineModel` becoming an official API (no longer requiring the `--defineModel` compile flag)."
---

Vue 3.4 released several high-quality improvements, most notably `defineModel` becoming an official API (no longer requiring the `--defineModel` compile flag).

## defineModel: Two-Way Binding for Custom Components

Previously, writing `v-model` for custom components was cumbersome:

```vue
<!-- Vue 3.3 之前 -->
<script setup lang="ts">
defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function handleInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
}
</script>

<template>
  <input :value="modelValue" @input="handleInput" />
</template>
```

```vue
<!-- Vue 3.4：defineModel -->
<script setup lang="ts">
const model = defineModel<string>();
</script>

<template>
  <input v-model="model" />
</template>
```

Done in one line! `defineModel` returns a readable and writable ref — reading it gives the prop value, writing it triggers the `update:modelValue` event.

## Multiple v-model

```vue
<!-- 子组件：UserForm.vue -->
<script setup lang="ts">
const firstName = defineModel<string>("firstName", { required: true });
const lastName = defineModel<string>("lastName", { required: true });
const age = defineModel<number>("age", { default: 0 });
</script>

<template>
  <div>
    <input v-model="firstName" placeholder="名" />
    <input v-model="lastName" placeholder="姓" />
    <input v-model.number="age" type="number" placeholder="年龄" />
  </div>
</template>
```

```vue
<!-- 父组件 -->
<UserForm
  v-model:firstName="form.firstName"
  v-model:lastName="form.lastName"
  v-model:age="form.age"
/>
```

## defineModel Modifiers

```vue
<script setup lang="ts">
// 接收修饰符（如 v-model.trim）
const [model, modifiers] = defineModel<string>({
  set(value) {
    if (modifiers.trim) {
      return value.trim();
    }
    if (modifiers.capitalize) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  },
});
</script>

<template>
  <input v-model="model" />
</template>
```

```vue
<!-- 父组件用法 -->
<MyInput v-model.trim.capitalize="text" />
```

## v-bind Shorthand for Same-Name Props

```vue
<!-- Vue 3.4 之前 -->
<template>
  <BlogPost
    :title="title"
    :author="author"
    :date="date"
    :tags="tags"
    :slug="slug"
  />
</template>

<!-- Vue 3.4：同名可简写 -->
<template>
  <BlogPost :title :author :date :tags :slug />
</template>
```

The same idea as JavaScript's object property shorthand — much more concise to write.

## Vue 3.5: useTemplateRef

```vue
<!-- 旧写法 -->
<script setup>
const inputRef = (ref < HTMLInputElement) | (null > null);
</script>
<template>
  <input ref="inputRef" />
</template>

<!-- Vue 3.5：useTemplateRef，ref 的名字和模板对应更明确 -->
<script setup>
import { useTemplateRef } from "vue";
const inputRef = useTemplateRef < HTMLInputElement > "myInput";
</script>
<template>
  <input ref="myInput" />
</template>
```

And the `once` option for `watch`:

```typescript
// 只监听一次，触发后自动停止
watch(
  user,
  (newUser) => {
    // 只在用户第一次登录时执行
    trackFirstLogin(newUser);
  },
  { once: true },
);
```

## Summary

- `defineModel` is the most important new feature in 3.4, greatly simplifying two-way binding for custom components
- `v-bind` shorthand makes templates more concise
- Vue 3.5's `useTemplateRef` makes template ref types more accurate
- The Vue team continues to polish the DX, with practical small improvements in every release