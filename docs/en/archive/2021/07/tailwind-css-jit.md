---
title: "Tailwind CSS 3.0 in Practice: JIT Mode"
date: 2021-07-14 16:44:41
tags:
  - CSS

readingTime: 2
description: "Tailwind CSS 2.x 开始流行，3.0 的 JIT（Just-in-Time）模式彻底改变了使用体验。"
---

Tailwind CSS 2.x 开始流行，3.0 的 JIT（Just-in-Time）模式彻底改变了使用体验。

## Why Tailwind CSS Is Growing in Popularity

以前的前端：写 HTML → 写 CSS 类 → 写 CSS 规则（来回切换文件）

Tailwind：把样式写在 HTML 里，不需要切换文件

```html
<!-- 传统方式 -->
<div class="card">
  <h2 class="card-title">标题</h2>
</div>
<!-- 还需要去 CSS 文件定义 .card 和 .card-title -->

<!-- Tailwind -->
<div class="rounded-lg border border-gray-200 p-4 shadow-sm">
  <h2 class="text-lg font-semibold text-gray-900">标题</h2>
</div>
<!-- 直接看 HTML 就知道样式 -->
```

## JIT 模式（3.0 核心特性）

之前的问题：Tailwind 的 CSS 文件很大（未使用的类很多），生产要用 PurgeCSS 清理。

JIT：根据源码按需生成 CSS，只生成用到的类，任意值也支持。

```bash
# 安装
npm install -D tailwindcss
npx tailwindcss init
```

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{html,js,ts,jsx,tsx,vue}"], // 扫描范围
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

## Arbitrary Values (JIT-Only)

```html
<!-- 之前：只能用预设的间距值 -->
<div class="mt-4 p-6">...</div>

<!-- JIT：任意值用方括号 -->
<div class="mt-[13px] p-[22px] w-[calc(100%-2rem)]">...</div>
<div class="bg-[#ff6b6b] text-[14px] top-[117px]">...</div>
```

## Combining with Vue 3

```vue
<template>
  <!-- 响应式：sm/md/lg 前缀 -->
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

## Dynamic Class Names (Caution!)

```vue
<!-- ❌ 动态拼接类名：JIT 无法扫描，不会生成对应 CSS -->
<div :class="`text-${size}-lg`"></div>

<!-- ✅ 完整类名：JIT 能识别 -->
<div :class="size === 'large' ? 'text-2xl' : 'text-base'"></div>

<!-- ✅ 或者用 safelist -->
// tailwind.config.js module.exports = { safelist: ['text-red-500',
'text-blue-500'] // 强制包含 }
```

## Component Abstraction (Avoiding Repetition)

```vue
<!-- 方案 1：用 @apply 把常用组合抽成类（但官方不推荐过度使用）-->
<style>
.btn-primary {
  @apply rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700;
}
</style>

<!-- 方案 2：封装 Vue 组件（推荐） -->
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

## My Experience

用了 3 个月 Tailwind，优缺点都很明显：

**优点：**

- 不用起类名（最省脑力的点）
- 响应式/hover/dark mode 极其方便
- 团队统一：不会有人写"野生"CSS

**缺点：**

- HTML 很长（class 一大串）
- 学习成本（要记类名）
- 不适合高度动态的样式

适合：后台管理系统、营销页、文档站。不适合：需要大量动画的展示型项目。

## Summary

- Tailwind 3.0 JIT：按需生成 CSS，支持任意值，无需 PurgeCSS
- 动态类名要用完整字符串，否则 JIT 扫描不到
- 组件封装 + Tailwind：复用靠组件，而不是靠 `@apply`