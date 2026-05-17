---
title: "Vue 3.4：defineModel と v-bind 同名省略記法"
date: 2024-04-12 16:06:12
tags:
  - Vue
readingTime: 2
description: "Vue 3.4 はいくつかの品質向上の高い機能をリリースしました。特に `defineModel` が正式 API となりました（`--defineModel` コンパイルフラグが不要になりました）。"
---

Vue 3.4 はいくつかの品質向上の高い機能をリリースしました。特に `defineModel` が正式 API となりました（`--defineModel` コンパイルフラグが不要になりました）。

## defineModel：カスタムコンポーネントの双方向バインディング

以前は `v-model` のカスタムコンポーネントを書くのが面倒でした：

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

1行で完了！`defineModel` は読み書き可能な ref を返します。読み取ると prop の値が返され、書き込むと `update:modelValue` イベントがトリガーされます。

## 複数の v-model

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

## defineModel の修飾子

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

## v-bind 同名省略記法

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

JavaScript のオブジェクトプロパティ省略記法と同じ考え方で、記述がずっと簡潔になります。

## Vue 3.5 の useTemplateRef

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

また、`watch` の `once` オプション：

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

## まとめ

- `defineModel` は 3.4 で最も重要な新機能で、カスタムコンポーネントの双方向バインディングを大幅に簡略化します
- `v-bind` 省略記法でテンプレートがよりシンプルになります
- Vue 3.5 の `useTemplateRef` はテンプレート ref の型をより正確にします
- Vue チームは DX の改善を続けており、毎バージョンで実用的な小改善があります