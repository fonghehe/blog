---
title: "Vue 3.5：响应式系统重写与性能飞跃"
date: 2024-06-10 10:00:00
tags:
  - Vue
readingTime: 2
description: "Vue 3.5 发布，这是 Vue 3 继 3.4 之后的又一个重要版本。最核心的变化是响应式系统的完全重写，带来了显著的内存和性能改善。"
---

Vue 3.5 发布，这是 Vue 3 继 3.4 之后的又一个重要版本。最核心的变化是响应式系统的完全重写，带来了显著的内存和性能改善。

## 响应式系统重写

Vue 3.5 对 `reactive()`、`ref()`、`computed()` 的底层实现做了重构，核心目标是减少内存占用。

官方数据显示：

```
内存占用降低 56%（大型响应式对象场景）
```

重写的重点是优化了 Proxy handler 的实现，减少了中间对象的创建。

### 对实际项目的影响

我们有一个数据密集型的管理后台，页面经常挂载 1000+ 个响应式节点：

```vue
<script setup lang="ts">
// 以前用 shallowRef 处理大数组避免响应式开销
const largeList = shallowRef<Item[]>([]);

// Vue 3.5 之后，普通 ref 也足够轻量
const largeList = ref<Item[]>([]);

// 1000 个对象的响应式包装，内存从 ~8MB 降到 ~3.5MB
</script>
```

## effectScope 增强

Vue 3.5 增强了 `effectScope` API，让副作用的统一管理更优雅：

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

## defineModel 稳定

在 Vue 3.4 引入后，`defineModel` 在 3.5 中成为稳定 API，不再需要实验性标记：

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

新增的 `useId` 组合式函数，生成服务端渲染安全的唯一 ID：

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

Teleport 组件新增 `defer` 选项，延迟到 DOM 就绪后再传送：

```vue
<template>
  <!-- 以前：如果 #modal-root 还没渲染，Teleport 会报错 -->
  <Teleport to="#modal-root" defer>
    <Modal />
  </Teleport>
</template>
```

## data-allow-mismatch

处理 SSR 水合不匹配的新属性：

```vue
<template>
  <!-- 日期、相对时间等经常不一致的内容 -->
  <time data-allow-mismatch>{{ formattedDate }}</time>
</template>
```

## 团队升级建议

```bash
pnpm update vue@3.5 @vitejs/plugin-vue
```

升级清单：

1. 检查 `experimentalDefineModel` 配置，可以移除
2. 大数组场景可以去掉 `shallowRef`，改用普通 `ref`
3. 组件 ID 生成逻辑可以迁移到 `useId`
4. 测试 SSR 水合是否正常

## 小结

- 响应式系统重写：内存占用降低约 56%，大型数据场景收益明显
- `defineModel` 稳定：简化 v-model 双向绑定
- `useId`：SSR 安全的唯一 ID 生成
- `effectScope` 增强：副作用统一管理
- Lazy Teleport：解决目标节点未就绪的问题
