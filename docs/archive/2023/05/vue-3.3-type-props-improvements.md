---
title: "Vue 3.3：类型系统与开发体验的全面提升"
date: 2023-05-02 14:50:55
tags:
  - Vue
readingTime: 2
description: "Vue 3.3 发布了。没有颠覆性新特性，但类型系统和 DX（开发体验）的改进非常实在。"
---

Vue 3.3 发布了。没有颠覆性新特性，但类型系统和 DX（开发体验）的改进非常实在。

## 泛型组件

终于支持了。之前用 Vue 写泛型组件需要用 `any` 或者 workaround，现在原生支持：

```vue
<script setup lang="ts" generic="T">
interface Props {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [item: T];
}>();

const selected = ref<T | null>(null);
</script>

<template>
  <ul>
    <li
      v-for="item in props.items"
      :key="props.keyExtractor(item)"
      @click="emit('select', item)"
    >
      {{ props.renderItem(item) }}
    </li>
  </ul>
</template>
```

`generic="T"` 让 `<script setup>` 支持泛型。在父组件使用时，`T` 会从传入的 `items` 自动推断：

```vue
<!-- 使用泛型组件 -->
<TypeList
  :items="users"
  :key-extractor="(u) => u.id"
  :render-item="(u) => u.name"
  @select="(user) => console.log(user.role)"
  <!--              ^? User 类型，自动推断 -->
/>
```

## defineProps 解构

```vue
<script setup lang="ts">
// 之前：必须用 withDefaults 包裹
const props = withDefaults(defineProps<{
  title: string;
  count?: number;
}>()), {
  count: 0,
});

// 3.3：响应式解构 + 默认值
const { title, count = 0 } = defineProps<{
  title: string;
  count?: number;
}>();

// count 现在是响应式的，值变化时自动更新
// 不需要 props.count，直接用 count
</script>
```

这依赖 Vue 3.3 的响应性语法糖（reactivity transform）。解构出来的变量自动保持响应性。

## 更好的 defineSlots

```vue
<script setup lang="ts">
defineSlots<{
  default(props: { item: any; index: number }): any;
  header(props: { title: string }): any;
  footer(): any;
}>();
</script>

<template>
  <div>
    <slot name="header" title="列表标题" />
    <slot v-for="(item, i) in items" :item="item" :index="i" />
    <slot name="footer" />
  </div>
</template>
```

插槽有了类型定义，父组件使用时会有类型检查和自动补全。

## defineModel 语法糖

```vue
<script setup lang="ts">
// 之前：需要手动声明 props + emit
const modelValue = defineModel<string>("value");
// 等价于：
// const props = defineProps<{ value: string }>();
// const emit = defineEmits<{ "update:value": [val: string] }>();

// 直接读写，自动同步到父组件
modelValue.value = "新值";
</script>

<template>
  <input v-model="modelValue" />
</template>
```

## 导入顺序不再烦恼

```vue
<script setup lang="ts">
// 3.3 之前：必须手动管理导入顺序
// 某些宏（defineProps 等）不能在导入之前使用

// 3.3：编译器自动处理，任意顺序都行
const props = defineProps<{ id: string }>();
import { computed } from "vue";
import { fetchUser } from "../api";
const user = computed(() => fetchUser(props.id));
</script>
```

编译器会自动把宏调用提升到导入之前，不再需要开发者手动排序。

## 外部导入类型

```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  email: string;
}
```

```vue
<script setup lang="ts">
import type { User } from "./types";

// 3.3 之前：需要特殊配置才能在 defineProps 里用外部类型
// 3.3：直接用，无需额外配置
const props = defineProps<{
  user: User;
}>();
</script>
```

## 性能改进

编译器优化：
- 生成的渲染函数代码更精简
- 静态分析能力增强，更多节点被标记为 hoisted
- SSR 产物体积减小约 10%

## 小结

- Vue 3.3 是一次 DX 大升级，类型系统终于补齐了泛型组件这块短板
- `defineModel` 大幅简化了双向绑定组件的写法
- 响应式解构让 `<script setup>` 更简洁
- 编译器优化带来了一定的性能提升
- 虽然没有新特性，但每天写代码都能感受到改善