---
title: "Vue 3.3：型別系統與開發體驗的全面提升"
date: 2023-05-02 14:50:55
tags:
  - Vue
readingTime: 2
description: "Vue 3.3 釋出了。沒有顛覆性新特性，但型別系統和 DX（開發體驗）的改進非常實在。"
wordCount: 344
---

Vue 3.3 釋出了。沒有顛覆性新特性，但型別系統和 DX（開發體驗）的改進非常實在。

## 泛型元件

終於支援了。之前用 Vue 寫泛型元件需要用 `any` 或者 workaround，現在原生支援：

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

`generic="T"` 讓 `<script setup>` 支援泛型。在父元件使用時，`T` 會從傳入的 `items` 自動推斷：

```vue
<!-- 使用泛型元件 -->
<TypeList
  :items="users"
  :key-extractor="(u) => u.id"
  :render-item="(u) => u.name"
  @select="(user) => console.log(user.role)"
  <!--              ^? User 型別，自動推斷 -->
/>
```

## defineProps 解構

```vue
<script setup lang="ts">
// 之前：必須用 withDefaults 包裹
const props = withDefaults(defineProps<{
  title: string;
  count?: number;
}>()), {
  count: 0,
});

// 3.3：響應式解構 + 預設值
const { title, count = 0 } = defineProps<{
  title: string;
  count?: number;
}>();

// count 現在是響應式的，值變化時自動更新
// 不需要 props.count，直接用 count
</script>
```

這依賴 Vue 3.3 的響應性語法糖（reactivity transform）。解構出來的變數自動保持響應性。

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
    <slot name="header" title="列表標題" />
    <slot v-for="(item, i) in items" :item="item" :index="i" />
    <slot name="footer" />
  </div>
</template>
```

插槽有了型別定義，父元件使用時會有型別檢查和自動補全。

## defineModel 語法糖

```vue
<script setup lang="ts">
// 之前：需要手動宣告 props + emit
const modelValue = defineModel<string>("value");
// 等價於：
// const props = defineProps<{ value: string }>();
// const emit = defineEmits<{ "update:value": [val: string] }>();

// 直接讀寫，自動同步到父元件
modelValue.value = "新值";
</script>

<template>
  <input v-model="modelValue" />
</template>
```

## 匯入順序不再煩惱

```vue
<script setup lang="ts">
// 3.3 之前：必須手動管理匯入順序
// 某些宏（defineProps 等）不能在匯入之前使用

// 3.3：編譯器自動處理，任意順序都行
const props = defineProps<{ id: string }>();
import { computed } from "vue";
import { fetchUser } from "../api";
const user = computed(() => fetchUser(props.id));
</script>
```

編譯器會自動把巨集呼叫提升到匯入之前，不再需要開發者手動排序。

## 外部匯入型別

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

// 3.3 之前：需要特殊設定才能在 defineProps 裡用外部型別
// 3.3：直接用，無需額外設定
const props = defineProps<{
  user: User;
}>();
</script>
```

## 效能改進

編譯器最佳化：
- 生成的渲染函式程式碼更精簡
- 靜態分析能力增強，更多節點被標記為 hoisted
- SSR 產物體積減小約 10%

## 小結

- Vue 3.3 是一次 DX 大升級，型別系統終於補齊了泛型元件這塊短板
- `defineModel` 大幅簡化了雙向繫結元件的寫法
- 響應式解構讓 `<script setup>` 更簡潔
- 編譯器最佳化帶來了一定的效能提升
- 雖然沒有新特性，但每天寫程式碼都能感受到改善