---
title: "Vue 3.6 新特性展望"
date: 2025-01-30 10:00:00
tags:
  - Vue
---

Vue 3.6 是 Evan You 在 2025 VueConf 上预览的下一个大版本，核心主题是「编译时优化 + Vapor Mode 正式稳定」。本文基于 RFC 和早期 alpha 版本，分析 3.6 中最值得关注的变化。

## 响应式系统：Ref Sugar 正式稳定

Ref Sugar（`$ref`、`$computed`）从实验性功能进入稳定版，彻底解决了 `ref.value` 的冗余问题。

```vue
<script setup lang="ts">
// Vue 3.5：需要 .value
const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, (val) => console.log(val));

// Vue 3.6 Ref Sugar：编译期自动脱糖
$ref: let count = 0;
$computed: let doubled = count * 2;

// watch 也可以简化
$watch: count, (val) => console.log(val);

function increment() {
  count++; // 不需要 .value
}

// 类型推导完全正确
$ref: let user = { name: '张三', age: 25 };
// user 的类型是 { name: string; age: number }
// 不是 Ref<{ name: string; age: number }>
</script>

<template>
  <button @click="increment">{{ count }} ({{ doubled }})</button>
</template>
```

编译器会把 `$ref` 转换为 `ref()`，`$computed` 转换为 `computed()`，模板中的访问自动添加 `.value`。这意味着零运行时开销，纯粹是语法糖。

## defineProps 解构默认值

3.6 终于支持了 props 解构的默认值声明，不再需要 `withDefaults`：

```vue
<script setup lang="ts">
// Vue 3.5：需要 withDefaults
// const props = withDefaults(defineProps<{ title: string; size?: number }>(), {
//   size: 16,
// });

// Vue 3.6：直接解构 + 默认值
const { title, size = 16, color = '#1a1a1a' } = defineProps<{
  title: string;
  size?: number;
  color?: string;
}>();

// 编译器自动处理：解构后的变量仍然是响应式的
// 不需要担心解构丢失响应性
console.log(size); // 直接使用，不需要 props.size

// 复杂默认值也支持
const { items = [], onSelect = () => {} } = defineProps<{
  items?: Item[];
  onSelect?: (item: Item) => void;
}>();
</script>
```

这个改动消除了 Vue 项目中最常见的代码噪音之一，类型推导也更自然。

## 组件懒加载改进

```vue
<script setup lang="ts">
import { defineAsyncComponent, hydrateOnVisible } from 'vue';

// Vue 3.6 新增：条件性懒加载
const AdminPanel = defineAsyncComponent({
  loader: () => import('./AdminPanel.vue'),
  // 只有当用户有权限时才加载
  condition: () => userStore.isAdmin,
  loadingComponent: () => import('./AdminSkeleton.vue'),
  // SSR 注水策略
  hydrate: hydrateOnVisible(),
});

// 批量预加载
import { prefetchComponents } from 'vue';

function onRouteHover() {
  // 鼠标悬停时预加载目标页面
  prefetchComponents([
    () => import('./Dashboard.vue'),
    () => import('./Analytics.vue'),
  ]);
}
</script>
```

`hydrateOnVisible` 是 3.6 新增的注水策略——组件进入视口时才注水，大幅减少首屏 JS 执行量。

## 响应式 Props 解构的陷阱与最佳实践

3.6 的响应式解构虽然方便，但有几个需要注意的点：

```vue
<script setup lang="ts">
const { items, filter } = defineProps<{
  items: Item[];
  filter: string;
}>();

// ❌ 错误：解构后的数组方法不会触发更新
// items.push(newItem); // 不会触发重新渲染

// ✅ 正确：修改操作通过 emit 或 toRef
const emit = defineEmits<{
  'update:items': [items: Item[]];
}>();

function addItem(item: Item) {
  emit('update:items', [...items, item]);
}

// ✅ 如果确实需要可变的本地副本
import { toRef } from 'vue';
const localItems = toRef(() => items);
// localItems 是一个 Ref，会跟随 props.items 变化
</script>
```

## 小结

- Ref Sugar 正式稳定，`$ref`/`$computed` 消除 `.value` 冗余，零运行时开销
- Props 解构支持原生默认值，不再需要 `withDefaults` 包裹
- `hydrateOnVisible` 实现视口级注水，优化 SSR 首屏性能
- 批量预加载 API 让路由切换更丝滑
- Vue 3.6 的核心策略是「编译期做更多优化，让开发者写更少的胶水代码」
