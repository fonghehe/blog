---
title: "Vue 3.4：defineModel 和 v-bind 同名簡寫"
date: 2024-04-12 16:06:12
tags:
  - Vue
readingTime: 2
description: "Vue 3.4 發佈了幾個質量提升很高的特性，特別是 `defineModel` 成為正式 API（不再需要 `--defineModel` 編譯標誌）。"
wordCount: 212
---

Vue 3.4 發佈了幾個質量提升很高的特性，特別是 `defineModel` 成為正式 API（不再需要 `--defineModel` 編譯標誌）。

## defineModel：自定義組件雙向綁定

以前寫 `v-model` 的自定義組件很繁瑣：

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

一行搞定！`defineModel` 返回一個可讀寫的 ref，讀取時是 prop 的值，寫入時觸發 `update:modelValue` 事件。

## 多個 v-model

```vue
<!-- 子組件：UserForm.vue -->
<script setup lang="ts">
const firstName = defineModel<string>("firstName", { required: true });
const lastName = defineModel<string>("lastName", { required: true });
const age = defineModel<number>("age", { default: 0 });
</script>

<template>
  <div>
    <input v-model="firstName" placeholder="名" />
    <input v-model="lastName" placeholder="姓" />
    <input v-model.number="age" type="number" placeholder="年齡" />
  </div>
</template>
```

```vue
<!-- 父組件 -->
<UserForm
  v-model:firstName="form.firstName"
  v-model:lastName="form.lastName"
  v-model:age="form.age"
/>
```

## defineModel 的修飾符

```vue
<script setup lang="ts">
// 接收修飾符（如 v-model.trim）
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
<!-- 父組件用法 -->
<MyInput v-model.trim.capitalize="text" />
```

## v-bind 同名簡寫

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

<!-- Vue 3.4：同名可簡寫 -->
<template>
  <BlogPost :title :author :date :tags :slug />
</template>
```

和 JavaScript 的對象屬性簡寫一樣的思路，寫起來簡潔多了。

## Vue 3.5 的 useTemplateRef

```vue
<!-- 舊寫法 -->
<script setup>
const inputRef = (ref < HTMLInputElement) | (null > null);
</script>
<template>
  <input ref="inputRef" />
</template>

<!-- Vue 3.5：useTemplateRef，ref 的名字和模板對應更明確 -->
<script setup>
import { useTemplateRef } from "vue";
const inputRef = useTemplateRef < HTMLInputElement > "myInput";
</script>
<template>
  <input ref="myInput" />
</template>
```

以及 `watch` 的 `once` 選項：

```typescript
// 只監聽一次，觸發後自動停止
watch(
  user,
  (newUser) => {
    // 只在用户第一次登錄時執行
    trackFirstLogin(newUser);
  },
  { once: true },
);
```

## 小結

- `defineModel` 是 3.4 最重要的新特性，極大簡化了自定義組件的雙向綁定
- `v-bind` 同名簡寫讓模板更簡潔
- Vue 3.5 的 `useTemplateRef` 讓模板 ref 的類型更準確
- Vue 團隊在持續打磨 DX，每個版本都有實用的小改進