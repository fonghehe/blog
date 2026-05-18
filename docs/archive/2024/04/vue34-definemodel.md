---
title: "Vue 3.4：defineModel 和 v-bind 同名简写"
date: 2024-04-12 16:06:12
tags:
  - Vue
readingTime: 2
description: "Vue 3.4 发布了几个质量提升很高的特性，特别是 `defineModel` 成为正式 API（不再需要 `--defineModel` 编译标志）。"
---

Vue 3.4 发布了几个质量提升很高的特性，特别是 `defineModel` 成为正式 API（不再需要 `--defineModel` 编译标志）。

## defineModel：自定义组件双向绑定

以前写 `v-model` 的自定义组件很繁琐：

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

一行搞定！`defineModel` 返回一个可读写的 ref，读取时是 prop 的值，写入时触发 `update:modelValue` 事件。

## 多个 v-model

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

## defineModel 的修饰符

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

## v-bind 同名简写

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

和 JavaScript 的对象属性简写一样的思路，写起来简洁多了。

## Vue 3.5 的 useTemplateRef

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

以及 `watch` 的 `once` 选项：

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

## 小结

- `defineModel` 是 3.4 最重要的新特性，极大简化了自定义组件的双向绑定
- `v-bind` 同名简写让模板更简洁
- Vue 3.5 的 `useTemplateRef` 让模板 ref 的类型更准确
- Vue 团队在持续打磨 DX，每个版本都有实用的小改进