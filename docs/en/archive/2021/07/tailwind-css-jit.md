---
title: "Tailwind CSS 3.0 in Practice: JIT Mode"
date: 2021-07-14 16:44:41
tags:
  - CSS

readingTime: 2
description: "Tailwind CSS 2.x started gaining popularity, and the 3.0 JIT (Just-in-Time) mode completely changed the experience."
wordCount: 255
---

Tailwind CSS 2.x started gaining popularity, and the 3.0 JIT (Just-in-Time) mode completely changed the experience.

## Why Tailwind CSS Is Growing in Popularity

The old front-end workflow: write HTML → write a CSS class → write the CSS rule (jumping back and forth between files)

Tailwind: you write styles right in the HTML, with no file switching

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

## JIT Mode (the Core 3.0 Feature)

The old problem: Tailwind's CSS file was huge (it contained many unused classes), so you had to clean it up with PurgeCSS for production.

JIT: it generates CSS on demand from your source code, emitting only the classes you actually use, and it also supports arbitrary values.

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

I've used Tailwind for three months now, and both the pros and cons are clear:

**Pros:**

- No need to come up with class names (the biggest mental relief)
- Responsive, hover, and dark mode are extremely convenient
- Consistent across the team: nobody writes "wild" CSS

**Cons:**

- HTML gets long (a huge string of classes)
- Learning curve (you have to memorize class names)
- Not great for highly dynamic styles

Best for: admin dashboards, marketing pages, and documentation sites. Not ideal for: showcase projects that need lots of animation.

## Summary

- Tailwind 3.0 JIT: generates CSS on demand, supports arbitrary values, and removes the need for PurgeCSS
- Use complete strings for dynamic class names, or JIT won't be able to detect them
- Component wrapping + Tailwind: reuse through components, not through `@apply`