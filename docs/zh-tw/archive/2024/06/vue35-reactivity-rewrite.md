---
title: "Vue 3.5：響應式系統重寫與效能飛躍"
date: 2024-06-10 10:00:00
tags:
  - Vue
readingTime: 2
description: "Vue 3.5 釋出，這是 Vue 3 繼 3.4 之後的又一個重要版本。最核心的變化是響應式系統的完全重寫，帶來了顯著的記憶體和效能改善。"
---

Vue 3.5 釋出，這是 Vue 3 繼 3.4 之後的又一個重要版本。最核心的變化是響應式系統的完全重寫，帶來了顯著的記憶體和效能改善。

## 響應式系統重寫

Vue 3.5 對 `reactive()`、`ref()`、`computed()` 的底層實現做了重構，核心目標是減少記憶體佔用。

官方資料顯示：

```
記憶體佔用降低 56%（大型響應式物件場景）
```

重寫的重點是優化了 Proxy handler 的實現，減少了中間物件的建立。

### 對實際專案的影響

我們有一個數據密集型的管理後臺，頁面經常掛載 1000+ 個響應式節點：

```vue
<script setup lang="ts">
// 以前用 shallowRef 處理大陣列避免響應式開銷
const largeList = shallowRef<Item[]>([]);

// Vue 3.5 之後，普通 ref 也足夠輕量
const largeList = ref<Item[]>([]);

// 1000 個物件的響應式包裝，記憶體從 ~8MB 降到 ~3.5MB
</script>
```

## effectScope 增強

Vue 3.5 增強了 `effectScope` API，讓副作用的統一管理更優雅：

```typescript
import { effectScope, watch, ref, onScopeDispose } from "vue";

function useDataSync(key: string) {
  const scope = effectScope();

  scope.run(() => {
    const data = ref(null);

    // 所有 watch 都在這個 scope 內
    watch(
      data,
      (val) => {
        localStorage.setItem(key, JSON.stringify(val));
      },
      { deep: true }
    );

    // scope 銷燬時，所有 watch 自動清理
    onScopeDispose(() => {
      console.log(`sync for ${key} disposed`);
    });
  });

  return scope;
}

// 在元件中使用
const syncScope = useDataSync("user-settings");
// 元件解除安裝時，scope 內的所有副作用自動清理
```

## defineModel 穩定

在 Vue 3.4 引入後，`defineModel` 在 3.5 中成為穩定 API，不再需要實驗性標記：

```vue
<!-- 子元件 -->
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

新增的 `useId` 組合式函式，生成服務端渲染安全的唯一 ID：

```vue
<script setup>
import { useId } from "vue";

const labelId = useId(); // "v-0"
const inputId = useId(); // "v-1"

// SSR 和 CSR 水合時保證一致
</script>

<template>
  <label :for="inputId">使用者名稱</label>
  <input :id="inputId" :aria-describedby="labelId" />
</template>
```

## Lazy Teleport

Teleport 元件新增 `defer` 選項，延遲到 DOM 就緒後再傳送：

```vue
<template>
  <!-- 以前：如果 #modal-root 還沒渲染，Teleport 會報錯 -->
  <Teleport to="#modal-root" defer>
    <Modal />
  </Teleport>
</template>
```

## data-allow-mismatch

處理 SSR 水合不匹配的新屬性：

```vue
<template>
  <!-- 日期、相對時間等經常不一致的內容 -->
  <time data-allow-mismatch>{{ formattedDate }}</time>
</template>
```

## 團隊升級建議

```bash
pnpm update vue@3.5 @vitejs/plugin-vue
```

升級清單：

1. 檢查 `experimentalDefineModel` 配置，可以移除
2. 大陣列場景可以去掉 `shallowRef`，改用普通 `ref`
3. 元件 ID 生成邏輯可以遷移到 `useId`
4. 測試 SSR 水合是否正常

## 小結

- 響應式系統重寫：記憶體佔用降低約 56%，大型資料場景收益明顯
- `defineModel` 穩定：簡化 v-model 雙向繫結
- `useId`：SSR 安全的唯一 ID 生成
- `effectScope` 增強：副作用統一管理
- Lazy Teleport：解決目標節點未就緒的問題
