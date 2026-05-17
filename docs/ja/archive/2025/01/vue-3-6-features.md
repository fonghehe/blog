---
title: "Vue 3.6 の新機能：Ref Sugar安定版・defineProps分割代入・hydrateOnVisible"
date: 2025-01-30 10:00:00
tags:
  - Vue
readingTime: 3
description: "Vue 3.6は2025年1月にリリースされ、長期間開発者プレビュー段階にあった**Ref Sugar**（`$ref`構文）の正式安定化、`defineProps`の分割代入サポート、そして`hydrateOnVisible`ディレクティブなど、SSRのハイドレーション制御機能が追加されました。"
---

Vue 3.6は2025年1月にリリースされ、長期間開発者プレビュー段階にあった**Ref Sugar**（`$ref`構文）の正式安定化、`defineProps`の分割代入サポート、そして`hydrateOnVisible`ディレクティブなど、SSRのハイドレーション制御機能が追加されました。

## Ref Sugar の正式安定化

Vue 3.6でRef Sugar（`$ref`構文）がデフォルトで安定版として使えるようになりました。`ref()`の`.value`アクセスを省略してよりシンプルなコードが書けます。

```vue
<!-- Before（ref の .value アクセス） -->
<script setup lang="ts">
import { ref, computed } from "vue";

const count = ref(0);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value++;
}
</script>

<template>
  <button @click="increment">{{ count }}</button>
  <p>2倍：{{ doubled }}</p>
</template>
```

```vue
<!-- After（Ref Sugar — .value 不要） -->
<script setup lang="ts">
// $ref: 変数は自動的に ref として扱われ .value が不要になる
let count = $ref(0);
const doubled = $computed(() => count * 2); // count.value ではなく count

function increment() {
  count++; // count.value++ ではなく count++
}
</script>

<template>
  <!-- テンプレートの書き方は変わらない -->
  <button @click="increment">{{ count }}</button>
  <p>2倍：{{ doubled }}</p>
</template>
```

### $refと通常のrefとの相互運用

```typescript
// $ref と ref() の混在は可能
import { ref } from "vue";

// 外部ライブラリから受け取った ref をそのまま使う
const externalCount = ref(0); // 通常の ref

// $ref に変換
let localCount = $ref(externalCount); // externalCount.value にアクセスせずに使える

// $raw() で元の ref オブジェクトを取得（関数に渡すときなど）
watch($raw(localCount), (newVal) => {
  console.log("変更:", newVal);
});
```

## defineProps の分割代入

Vue 3.6では`defineProps`で受け取ったpropsを分割代入できるようになりました。これは以前`withDefaults` + 分割代入で発生していたリアクティビティの消失問題を解決します。

```vue
<!-- Before：分割代入するとリアクティビティが消えていた -->
<script setup lang="ts">
const props = defineProps<{
  title: string;
  count: number;
  items: string[];
}>();

// ❌ 分割代入するとリアクティビティが失われる
// const { title, count } = props

// ✅ 回避策：toRef / toRefs を使う必要があった
const { title, count } = toRefs(props);
</script>
```

```vue
<!-- After（Vue 3.6）：分割代入でもリアクティビティが維持される -->
<script setup lang="ts">
// 直接分割代入できる
const {
  title,
  count = 0, // デフォルト値も inline で設定できる
  items = [],
} = defineProps<{
  title: string;
  count?: number;
  items?: string[];
}>();

// title, count, items はリアクティブなまま（.value 不要）
const doubled = computed(() => count * 2);
</script>

<template>
  <h1>{{ title }}</h1>
  <p>{{ count }} × 2 = {{ doubled }}</p>
</template>
```

## hydrateOnVisible：Lazy Hydration の制御

Vue 3.6は`hydrateOnVisible`ディレクティブを追加し、コンポーネントがビューポートに入ったときにハイドレーションを実行できます。

```vue
<script setup>
import { defineAsyncComponent } from "vue";

// 非同期コンポーネントとして定義
const HeavyWidget = defineAsyncComponent(() => import("./HeavyWidget.vue"));
</script>

<template>
  <!-- hydrateOnVisible：コンポーネントがビューポートに入ったとき初めてハイドレーション -->
  <!-- SSR したコンテンツはすぐ表示されるが、JS のハイドレーションは遅延される -->
  <HeavyWidget v-hydrate:visible="{ rootMargin: '100px' }" />

  <!-- hydrate:idle：ブラウザのアイドル時間にハイドレーション -->
  <AnalyticsWidget v-hydrate:idle />

  <!-- hydrate:interaction：特定のイベントが発火したときにハイドレーション -->
  <CommentSection v-hydrate:interaction="['click', 'focus']" />

  <!-- hydrate:never：ハイドレーションしない（純粋な静的コンテンツ） -->
  <StaticFooter v-hydrate:never />
</template>
```

実際の使用例：

```vue
<!-- pages/product/[id].vue — Nuxt / Vue Router の SSR ページ -->
<template>
  <div class="product-page">
    <!-- ファーストビュー：即ハイドレーション -->
    <ProductHeader :product="product" />
    <ProductGallery :images="product.images" />
    <AddToCartButton :productId="product.id" />

    <!-- 折り返し以下：ビューポートに入ったときにハイドレーション -->
    <ProductReviews v-hydrate:visible :productId="product.id" />
    <RelatedProducts
      v-hydrate:visible="{ rootMargin: '200px' }"
      :categoryId="product.categoryId"
    />

    <!-- アクセス解析ウィジェット：アイドル時にハイドレーション（UX に影響しない） -->
    <AnalyticsTracker v-hydrate:idle :pageData="analyticsData" />
  </div>
</template>
```

## Vue 3.6 Vapor Mode（プレビュー）

Vue 3.6にはVapor Modeのプレビューも含まれています。Vapor ModeはVirtual DOMを使わずにネイティブDOMを直接操作するコンパイル最適化で、パフォーマンスが大幅に向上します。

```vue
<!-- Vapor Mode の有効化（コンポーネント単位） -->
<script setup vapor>
//               ↑ "vapor" を追加するだけ

const count = ref(0);
</script>

<template>
  <button @click="count++">{{ count }}</button>
</template>
```

## まとめ

Vue 3.6のRef Sugar安定化は、Composition APIの記述量を減らしながら型安全性を維持できる実践的な改善です。`defineProps`の分割代入改善も、これまでの`toRefs`回避策の必要をなくします。`hydrateOnVisible`はNuxt.jsなどのSSRフレームワークで特に有効で、TTI（Time to Interactive）の改善に直接貢献します。
