---
title: "Vue 3.5: Reactivity System Rewrite and Performance Leap"
date: 2024-06-10 12:44:21
tags:
  - Vue
readingTime: 2
description: "Vue 3.5 has been released — another important version following 3.4. The most significant change is a complete rewrite of the reactivity system, bringing notabl"
wordCount: 233
---

Vue 3.5 has been released — another important version following 3.4. The most significant change is a complete rewrite of the reactivity system, bringing notable memory and performance improvements.

## Reactivity System Rewrite

Vue 3.5 refactored the underlying implementation of `reactive()`, `ref()`, and `computed()`, with the core goal of reducing memory usage.

Official data shows:

```
内存占用降低 56%（大型响应式对象场景）
```

The rewrite focused on optimizing the Proxy handler implementation and reducing the creation of intermediate objects.

### Impact on Real Projects

We have a data-intensive admin panel where pages often mount 1000+ reactive nodes:

```vue
<script setup lang="ts">
// 以前用 shallowRef 处理大数组避免响应式开销
const largeList = shallowRef<Item[]>([]);

// Vue 3.5 之后，普通 ref 也足够轻量
const largeList = ref<Item[]>([]);

// 1000 个对象的响应式包装，内存从 ~8MB 降到 ~3.5MB
</script>
```

## effectScope Enhancement

Vue 3.5 enhanced the `effectScope` API, making unified management of side effects more elegant:

```typescript
import { effectScope, watch, ref, onScopeDispose } from "vue";

function useDataSync(key: string) {
  const scope = effectScope();

  scope.run(() => {
    const data = ref(null);

    // 所有 watch 都在这个 scope 内
    watch(
      data,
      (val) => {
        localStorage.setItem(key, JSON.stringify(val));
      },
      { deep: true }
    );

    // scope 销毁时，所有 watch 自动清理
    onScopeDispose(() => {
      console.log(`sync for ${key} disposed`);
    });
  });

  return scope;
}

// 在组件中使用
const syncScope = useDataSync("user-settings");
// 组件卸载时，scope 内的所有副作用自动清理
```

## defineModel Stabilized

Introduced in Vue 3.4, `defineModel` becomes a stable API in 3.5, no longer requiring the experimental flag:

```vue
<!-- 子组件 -->
<script setup>
// 以前：需要 modelValue + emit update
// const props = defineProps(['modelValue']);
// const emit = defineEmits(['update:modelValue']);

// Vue 3.5：一行搞定
const modelValue = defineModel();
const count = defineModel("count", { default: 0 });
</script>

<template>
  <input v-model="modelValue" />
  <input v-model="count" type="number" />
</template>
```

## useId

The new `useId` composable generates SSR-safe unique IDs:

```vue
<script setup>
import { useId } from "vue";

const labelId = useId(); // "v-0"
const inputId = useId(); // "v-1"

// SSR 和 CSR 水合时保证一致
</script>

<template>
  <label :for="inputId">用户名</label>
  <input :id="inputId" :aria-describedby="labelId" />
</template>
```

## Lazy Teleport

The Teleport component gains a `defer` option, delaying teleportation until the DOM is ready:

```vue
<template>
  <!-- 以前：如果 #modal-root 还没渲染，Teleport 会报错 -->
  <Teleport to="#modal-root" defer>
    <Modal />
  </Teleport>
</template>
```

## data-allow-mismatch

A new attribute for handling SSR hydration mismatches:

```vue
<template>
  <!-- 日期、相对时间等经常不一致的内容 -->
  <time data-allow-mismatch>{{ formattedDate }}</time>
</template>
```

## Team Upgrade Recommendations

```bash
pnpm update vue@3.5 @vitejs/plugin-vue
```

Upgrade checklist:

1. Remove the `experimentalDefineModel` configuration
2. In large-array scenarios, remove `shallowRef` and use regular `ref`
3. Migrate component ID generation logic to `useId`
4. Test that SSR hydration works correctly

## Summary

- Reactivity system rewrite: memory usage reduced by ~56%, significant gains in large-data scenarios
- `defineModel` stabilized: simplifies v-model two-way binding
- `useId`: SSR-safe unique ID generation
- `effectScope` enhanced: unified side-effect management
- Lazy Teleport: solves the issue of the target node not being ready
