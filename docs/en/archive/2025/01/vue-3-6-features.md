---
title: "Vue 3.6 New Features Preview"
date: 2025-01-30 16:24:01
tags:
  - Vue
readingTime: 2
description: "Vue 3.6 is the next major version previewed by Evan You at VueConf 2025, with the core theme of \"compile-time optimization + Vapor Mode going officially stable."
wordCount: 241
---

Vue 3.6 is the next major version previewed by Evan You at VueConf 2025, with the core theme of "compile-time optimization + Vapor Mode going officially stable." This article analyzes the most noteworthy changes in 3.6, based on RFCs and early alpha builds.

## Reactivity System: Ref Sugar Goes Stable

Ref Sugar (`$ref`, `$computed`) moves from experimental to stable, completely solving the verbosity of `ref.value`.

```vue
<script setup lang="ts">
// Vue 3.5: requires .value
const count = ref(0);
const doubled = computed(() => count.value * 2);
watch(count, (val) => console.log(val));

// Vue 3.6 Ref Sugar: compiler auto-desugars
$ref: let count = 0;
$computed: let doubled = count * 2;

// watch can also be simplified
$watch: (count, (val) => console.log(val));

function increment() {
  count++; // no .value needed
}

// Type inference is completely correct
$ref: let user = { name: "张三", age: 25 };
// user's type is { name: string; age: number }
// NOT Ref<{ name: string; age: number }>
</script>

<template>
  <button @click="increment">{{ count }} ({{ doubled }})</button>
</template>
```

The compiler converts `$ref` to `ref()` and `$computed` to `computed()`, automatically adding `.value` for template access. This means zero runtime overhead — it's purely syntactic sugar.

## defineProps Destructuring Default Values

3.6 finally supports declaring default values directly via destructuring, eliminating the need for `withDefaults`:

```vue
<script setup lang="ts">
// Vue 3.5: required withDefaults
// const props = withDefaults(defineProps<{ title: string; size?: number }>(), {
//   size: 16,
// });

// Vue 3.6: direct destructuring + default values
const {
  title,
  size = 16,
  color = "#1a1a1a",
} = defineProps<{
  title: string;
  size?: number;
  color?: string;
}>();

// The compiler handles this automatically: destructured variables remain reactive
// No need to worry about losing reactivity after destructuring
console.log(size); // use directly, no need for props.size

// Complex defaults are also supported
const { items = [], onSelect = () => {} } = defineProps<{
  items?: Item[];
  onSelect?: (item: Item) => void;
}>();
</script>
```

This change eliminates one of the most common sources of noise in Vue projects, and type inference is more natural.

## Component Lazy Loading Improvements

```vue
<script setup lang="ts">
import { defineAsyncComponent, hydrateOnVisible } from "vue";

// New in Vue 3.6: conditional lazy loading
const AdminPanel = defineAsyncComponent({
  loader: () => import("./AdminPanel.vue"),
  // Only load when the user has permissions
  condition: () => userStore.isAdmin,
  loadingComponent: () => import("./AdminSkeleton.vue"),
  // SSR hydration strategy
  hydrate: hydrateOnVisible(),
});

// Batch prefetch
import { prefetchComponents } from "vue";

function onRouteHover() {
  // Prefetch target pages on mouse hover
  prefetchComponents([
    () => import("./Dashboard.vue"),
    () => import("./Analytics.vue"),
  ]);
}
</script>
```

`hydrateOnVisible` is a new hydration strategy in 3.6 — the component only hydrates when it enters the viewport, significantly reducing the amount of JS executed on the first screen.

## Caveats and Best Practices for Reactive Props Destructuring

Although Vue 3.6's reactive destructuring is convenient, there are a few things to watch out for:

```vue
<script setup lang="ts">
const { items, filter } = defineProps<{
  items: Item[];
  filter: string;
}>();

// ❌ Wrong: array methods on destructured values don't trigger updates
// items.push(newItem); // won't trigger re-render

// ✅ Correct: mutations go through emit or toRef
const emit = defineEmits<{
  "update:items": [items: Item[]];
}>();

function addItem(item: Item) {
  emit("update:items", [...items, item]);
}

// ✅ If you genuinely need a mutable local copy
import { toRef } from "vue";
const localItems = toRef(() => items);
// localItems is a Ref that tracks props.items changes
</script>
```

## Summary

- Ref Sugar goes stable; `$ref`/`$computed` eliminate `.value` verbosity with zero runtime overhead
- Props destructuring supports native default values, removing the need for `withDefaults` wrappers
- `hydrateOnVisible` enables viewport-level hydration, optimizing SSR first-screen performance
- Batch prefetch API makes route transitions smoother
- Vue 3.6's core strategy: "do more optimization at compile time, let developers write less glue code"
