---
title: "Tailwind CSS 3.0 実践：JIT モード"
date: 2021-07-14 16:44:41
tags:
  - CSS

readingTime: 3
description: "Tailwind CSS 2.x が普及し始め、3.0 の JIT（Just-in-Time）モードによって使用体験が根本的に変わりました。"
wordCount: 569
---

Tailwind CSS 2.x が普及し始め、3.0 の JIT（Just-in-Time）モードによって使用体験が根本的に変わりました。

## なぜ Tailwind CSS が人気になっているか

以前のフロントエンド：HTML を書く → CSS クラスを書く → CSS ルールを書く（ファイルを往復）

Tailwind：HTML にスタイルを直接書く、ファイルを切り替える必要がない

```html
<!-- 従来の方法 -->
<div class="card">
  <h2 class="card-title">标题</h2>
</div>
<!-- CSS ファイルで .card と .card-title を定義する必要もある -->

<!-- Tailwind -->
<div class="rounded-lg border border-gray-200 p-4 shadow-sm">
  <h2 class="text-lg font-semibold text-gray-900">标题</h2>
</div>
<!-- HTML を見ればスタイルがわかる -->
```

## JIT モード（3.0 の核心機能）

以前の問題点：Tailwind の CSS ファイルが大きい（未使用のクラスが多い）、本番では PurgeCSS で掃除する必要があった。

JIT：ソースコードに基づいて CSS をオンデマンドで生成し、使用するクラスのみを生成、任意の値もサポート。

```bash
# インストール
npm install -D tailwindcss
npx tailwindcss init
```

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx,vue}"], // スキャン範囲
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          900: "#1e3a8a",
        },
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
      },
    },
  },
  plugins: [],
};
```

## 任意の値（JIT限定）

```html
<!-- 以前：プリセットの間隔値のみ使用可能 -->
<div class="mt-4 p-6">...</div>

<!-- JIT：任意の値は角括弧で指定 -->
<div class="mt-[13px] p-[22px] w-[calc(100%-2rem)]">...</div>
<div class="bg-[#ff6b6b] text-[14px] top-[117px]">...</div>
```

## Vue 3 との組み合わせ

```vue
<template>
  <!-- レスポンシブ：sm/md/lg プレフィックス -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="product in products"
      :key="product.id"
      class="rounded-xl bg-white p-6 shadow-md hover:shadow-lg transition-shadow"
    >
      <img
        :src="product.image"
        class="mb-4 h-48 w-full rounded-lg object-cover"
      />
      <h3 class="text-lg font-bold text-gray-900">{{ product.name }}</h3>
      <p class="mt-1 text-sm text-gray-500">{{ product.description }}</p>
      <div class="mt-4 flex items-center justify-between">
        <span class="text-xl font-bold text-blue-600"
          >¥{{ product.price }}</span
        >
        <button
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800"
          @click="addToCart(product)"
        >
          加入购物车
        </button>
      </div>
    </div>
  </div>
</template>
```

## 動的クラス名（注意！）

```vue
<!-- ❌ 動的なクラス名の連結：JIT がスキャンできず、対応する CSS が生成されない -->
<div :class="`text-${size}-lg`"></div>

<!-- ✅ 完全なクラス名：JIT が認識可能 -->
<div :class="size === 'large' ? 'text-2xl' : 'text-base'"></div>

<!-- ✅ または safelist を使用 -->
// tailwind.config.js module.exports = { safelist: ['text-red-500',
'text-blue-500'] // 強制的に含める }
```

## コンポーネント抽象化（重複回避）

```vue
<!-- 方法 1：@apply でよく使う組み合わせをクラスに抽出（ただし公式は過度な使用を推奨しない） -->
<style>
.btn-primary {
  @apply rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700;
}
</style>

<!-- 方法 2：Vue コンポーネントとしてカプセル化（推奨） -->
<!-- components/BaseButton.vue -->
<template>
  <button :class="buttonClasses" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}>();

const buttonClasses = computed(() => {
  const base = "rounded-lg font-medium transition-colors";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  return [
    base,
    variants[props.variant ?? "primary"],
    sizes[props.size ?? "md"],
  ];
});
</script>
```

## 使用感

3 ヶ月間 Tailwind を使ってみて、メリットとデメリットはともに明確です：

**メリット：**

- クラス名を考えなくてよい（最も頭を使わなくて済む点）
- レスポンシブ / hover / dark mode が非常に便利
- チームで統一される：「野良」CSS が発生しない

**デメリット：**

- HTML が長くなる（class がずらりと並ぶ）
- 学習コスト（クラス名を覚える必要がある）
- 高度に動的なスタイルには不向き

適している：管理画面、マーケティングページ、ドキュメントサイト。適していない：大量のアニメーションが必要なショーケース系プロジェクト。

## まとめ

- Tailwind 3.0 JIT：オンデマンドで CSS を生成、任意の値をサポート、PurgeCSS 不要
- 動的クラス名は完全な文字列で記述すること、さもないと JIT がスキャンできない
- コンポーネントのカプセル化 + Tailwind：再利用はコンポーネントで行い、`@apply` に頼らない
