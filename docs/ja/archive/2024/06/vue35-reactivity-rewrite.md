---
title: "Vue 3.5：リアクティビティシステムの書き直しとパフォーマンス向上"
date: 2024-06-10 10:00:00
tags:
  - Vue
readingTime: 3
description: "Vue 3.5 がリリースされました。Vue 3.4 に続くもう一つの重要なバージョンです。最も重要な変更はリアクティビティシステムの完全な書き直しで、顕著なメモリとパフォーマンスの改善をもたらします。"
wordCount: 659
---

Vue 3.5 がリリースされました。Vue 3.4 に続くもう一つの重要なバージョンです。最も重要な変更はリアクティビティシステムの完全な書き直しで、顕著なメモリとパフォーマンスの改善をもたらします。

## リアクティビティシステムの書き直し

Vue 3.5 は `reactive()`、`ref()`、`computed()` の底層実装をリファクタリングし、メモリ使用量の削減を核心目標としています。

公式データによると：

```
内存占用降低 56%（大型响应式对象场景）
```

書き直しの重点は Proxy ハンドラーの実装の最適化と中間オブジェクトの生成削減です。

### 実際のプロジェクトへの影響

私たちはデータ集約型の管理画面を持っており、ページには 1000 以上のリアクティブノードが頻繁にマウントされます：

```vue
<script setup lang="ts">
// 以前用 shallowRef 处理大数组避免响应式开销
const largeList = shallowRef<Item[]>([]);

// Vue 3.5 之后，普通 ref 也足够轻量
const largeList = ref<Item[]>([]);

// 1000 个对象的响应式包装，内存从 ~8MB 降到 ~3.5MB
</script>
```

## effectScope の強化

Vue 3.5 は `effectScope` API を強化し、副作用の統一管理をよりエレガントにします：

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

## defineModel の安定化

Vue 3.4 で導入された後、`defineModel` は 3.5 で安定 API となり、実験的なフラグが不要になりました：

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

新しく追加された `useId` コンポーザブルは SSR 安全な一意 ID を生成します：

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

Teleport コンポーネントに `defer` オプションが追加され、DOM の準備ができるまでテレポートを遅延させます：

```vue
<template>
  <!-- 以前：如果 #modal-root 还没渲染，Teleport 会报错 -->
  <Teleport to="#modal-root" defer>
    <Modal />
  </Teleport>
</template>
```

## data-allow-mismatch

SSR ハイドレーションの不一致を処理する新しい属性：

```vue
<template>
  <!-- 日期、相对时间等经常不一致的内容 -->
  <time data-allow-mismatch>{{ formattedDate }}</time>
</template>
```

## チームのアップグレード推奨

```bash
pnpm update vue@3.5 @vitejs/plugin-vue
```

アップグレードチェックリスト：

1. `experimentalDefineModel` の設定を削除できます
2. 大きな配列のシナリオでは `shallowRef` を削除して通常の `ref` を使用できます
3. コンポーネント ID 生成ロジックを `useId` に移行できます
4. SSR ハイドレーションが正常に動作するかテストします

## まとめ

- リアクティビティシステムの書き直し：メモリ使用量が約 56% 削減、大規模データシナリオで顕著な効果
- `defineModel` 安定化：v-model 双方向バインディングを簡略化
- `useId`：SSR 安全な一意 ID 生成
- `effectScope` 強化：副作用の統一管理
- Lazy Teleport：対象ノードが未準備の問題を解決
