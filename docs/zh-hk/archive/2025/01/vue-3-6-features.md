---
title: "Vue 3.6 新特性展望"
date: 2025-01-30 10:00:00
tags:
  - Vue
readingTime: 2
description: "Vue 3.6 是 Evan You 在 2025 VueConf 上預覽的下一個大版本，核心主題是「編譯時優化 + Vapor Mode 正式穩定」。本文基於 RFC 和早期 alpha 版本，分析 3.6 中最值得關注的變化。"
wordCount: 369
---

Vue 3.6 是 Evan You 在 2025 VueConf 上預覽的下一個大版本，核心主題是「編譯時優化 + Vapor Mode 正式穩定」。本文基於 RFC 和早期 alpha 版本，分析 3.6 中最值得關注的變化。

## 響應式系統：Ref Sugar 正式穩定

Ref Sugar（`$ref`、`$computed`）從實驗性功能進入穩定版，徹底解決了 `ref.value` 的冗餘問題。

```vue
<script setup lang="ts">
// Vue 3.5：需要 .value
const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, (val) => console.log(val));

// Vue 3.6 Ref Sugar：編譯期自動脱糖
$ref: let count = 0;
$computed: let doubled = count * 2;

// watch 也可以簡化
$watch: count, (val) => console.log(val);

function increment() {
  count++; // 不需要 .value
}

// 類型推導完全正確
$ref: let user = { name: '張三', age: 25 };
// user 的類型是 { name: string; age: number }
// 不是 Ref<{ name: string; age: number }>
</script>

<template>
  <button @click="increment">{{ count }} ({{ doubled }})</button>
</template>
```

編譯器會把 `$ref` 轉換為 `ref()`，`$computed` 轉換為 `computed()`，模板中的訪問自動添加 `.value`。這意味着零運行時開銷，純粹是語法糖。

## defineProps 解構默認值

3.6 終於支持了 props 解構的默認值聲明，不再需要 `withDefaults`：

```vue
<script setup lang="ts">
// Vue 3.5：需要 withDefaults
// const props = withDefaults(defineProps<{ title: string; size?: number }>(), {
//   size: 16,
// });

// Vue 3.6：直接解構 + 默認值
const { title, size = 16, color = '#1a1a1a' } = defineProps<{
  title: string;
  size?: number;
  color?: string;
}>();

// 編譯器自動處理：解構後的變量仍然是響應式的
// 不需要擔心解構丟失響應性
console.log(size); // 直接使用，不需要 props.size

// 複雜默認值也支持
const { items = [], onSelect = () => {} } = defineProps<{
  items?: Item[];
  onSelect?: (item: Item) => void;
}>();
</script>
```

這個改動消除了 Vue 項目中最常見的代碼噪音之一，類型推導也更自然。

## 組件懶加載改進

```vue
<script setup lang="ts">
import { defineAsyncComponent, hydrateOnVisible } from 'vue';

// Vue 3.6 新增：條件性懶加載
const AdminPanel = defineAsyncComponent({
  loader: () => import('./AdminPanel.vue'),
  // 只有當用户有權限時才加載
  condition: () => userStore.isAdmin,
  loadingComponent: () => import('./AdminSkeleton.vue'),
  // SSR 注水策略
  hydrate: hydrateOnVisible(),
});

// 批量預加載
import { prefetchComponents } from 'vue';

function onRouteHover() {
  // 鼠標懸停時預加載目標頁面
  prefetchComponents([
    () => import('./Dashboard.vue'),
    () => import('./Analytics.vue'),
  ]);
}
</script>
```

`hydrateOnVisible` 是 3.6 新增的注水策略——組件進入視口時才注水，大幅減少首屏 JS 執行量。

## 響應式 Props 解構的陷阱與最佳實踐

3.6 的響應式解構雖然方便，但有幾個需要注意的點：

```vue
<script setup lang="ts">
const { items, filter } = defineProps<{
  items: Item[];
  filter: string;
}>();

// ❌ 錯誤：解構後的數組方法不會觸發更新
// items.push(newItem); // 不會觸發重新渲染

// ✅ 正確：修改操作通過 emit 或 toRef
const emit = defineEmits<{
  'update:items': [items: Item[]];
}>();

function addItem(item: Item) {
  emit('update:items', [...items, item]);
}

// ✅ 如果確實需要可變的本地副本
import { toRef } from 'vue';
const localItems = toRef(() => items);
// localItems 是一個 Ref，會跟隨 props.items 變化
</script>
```

## 小結

- Ref Sugar 正式穩定，`$ref`/`$computed` 消除 `.value` 冗餘，零運行時開銷
- Props 解構支持原生默認值，不再需要 `withDefaults` 包裹
- `hydrateOnVisible` 實現視口級注水，優化 SSR 首屏性能
- 批量預加載 API 讓路由切換更絲滑
- Vue 3.6 的核心策略是「編譯期做更多優化，讓開發者寫更少的膠水代碼」
