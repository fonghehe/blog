---
title: "Tailwind CSS 3.0 實戰：JIT 模式"
date: 2021-07-14 16:44:41
tags:
  - CSS
  - TailwindCSS
readingTime: 2
description: "Tailwind CSS 2.x 開始流行，3.0 的 JIT（Just-in-Time）模式徹底改變了使用體驗。"
wordCount: 327
---

Tailwind CSS 2.x 開始流行，3.0 的 JIT（Just-in-Time）模式徹底改變了使用體驗。

## 為什麼 Tailwind CSS 越來越流行

以前的前端：寫 HTML → 寫 CSS 類 → 寫 CSS 規則（來回切換檔案）

Tailwind：把樣式寫在 HTML 裡，不需要切換檔案

```html
<!-- 傳統方式 -->
<div class="card">
  <h2 class="card-title">標題</h2>
</div>
<!-- 還需要去 CSS 檔案定義 .card 和 .card-title -->

<!-- Tailwind -->
<div class="rounded-lg border border-gray-200 p-4 shadow-sm">
  <h2 class="text-lg font-semibold text-gray-900">標題</h2>
</div>
<!-- 直接看 HTML 就知道樣式 -->
```

## JIT 模式（3.0 核心特性）

之前的問題：Tailwind 的 CSS 檔案很大（未使用的類很多），生產要用 PurgeCSS 清理。

JIT：根據原始碼按需生成 CSS，只生成用到的類，任意值也支援。

```bash
# 安裝
npm install -D tailwindcss
npx tailwindcss init
```

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx,vue}"], // 掃描範圍
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

## 任意值（JIT 特有）

```html
<!-- 之前：只能用預設的間距值 -->
<div class="mt-4 p-6">...</div>

<!-- JIT：任意值用方括號 -->
<div class="mt-[13px] p-[22px] w-[calc(100%-2rem)]">...</div>
<div class="bg-[#ff6b6b] text-[14px] top-[117px]">...</div>
```

## 和 Vue 3 結合

```vue
<template>
  <!-- 響應式：sm/md/lg 字首 -->
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
          加入購物車
        </button>
      </div>
    </div>
  </div>
</template>
```

## 動態類名（注意！）

```vue
<!-- ❌ 動態拼接類名：JIT 無法掃描，不會生成對應 CSS -->
<div :class="`text-${size}-lg`"></div>

<!-- ✅ 完整類名：JIT 能識別 -->
<div :class="size === 'large' ? 'text-2xl' : 'text-base'"></div>

<!-- ✅ 或者用 safelist -->
// tailwind.config.js module.exports = { safelist: ['text-red-500',
'text-blue-500'] // 強制包含 }
```

## 元件抽象（避免重複）

```vue
<!-- 方案 1：用 @apply 把常用組合抽成類（但官方不推薦過度使用）-->
<style>
.btn-primary {
  @apply rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700;
}
</style>

<!-- 方案 2：封裝 Vue 元件（推薦） -->
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

## 我的使用感受

用了 3 個月 Tailwind，優缺點都很明顯：

**優點：**

- 不用起類名（最省腦力的點）
- 響應式/hover/dark mode 極其方便
- 團隊統一：不會有人寫"野生"CSS

**缺點：**

- HTML 很長（class 一大串）
- 學習成本（要記類名）
- 不適合高度動態的樣式

適合：後臺管理系統、營銷頁、文件站。不適合：需要大量動畫的展示型專案。

## 小結

- Tailwind 3.0 JIT：按需生成 CSS，支援任意值，無需 PurgeCSS
- 動態類名要用完整字串，否則 JIT 掃描不到
- 元件封裝 + Tailwind：複用靠元件，而不是靠 `@apply`