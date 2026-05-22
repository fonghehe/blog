---
title: "Tailwind CSS 實用指南：落地路徑與實戰建議"
date: 2020-10-06 14:38:55
tags:
  - CSS
readingTime: 2
description: "Tailwind CSS 這兩年越來越火，最近在一個內部工具項目中試用了一下。從\"這寫法太奇怪了\"到\"真香\"，記錄一下實際體驗。"
wordCount: 179
---

Tailwind CSS 這兩年越來越火，最近在一個內部工具項目中試用了一下。從"這寫法太奇怪了"到"真香"，記錄一下實際體驗。

## 告別 CSS 檔案跳轉

```html
<!-- 傳統寫法：HTML 和 CSS 分離 -->
<div class="card">
  <h2 class="card-title">標題</h2>
  <p class="card-desc">描述文字</p>
</div>

<!-- 需要打開 CSS 檔案看 card-title 具體是什麼 -->
<!-- .card-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; } -->

<!-- Tailwind 寫法：樣式直接寫在 HTML 裏 -->
<div class="bg-white rounded-lg shadow p-6">
  <h2 class="text-xl font-semibold mb-2">標題</h2>
  <p class="text-gray-600">描述文字</p>
</div>

<!-- 一眼就知道什麼樣式，不用跳文件 -->
```

## 安裝設定

```bash
# Vue CLI 項目
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```javascript
// tailwind.config.js
module.exports = {
  purge: ['./src/**/*.vue', './src/**/*.html'],
  theme: {
    extend: {
      colors: {
        primary: '#409eff',
        success: '#67c23a',
        warning: '#e6a23c',
        danger: '#f56c6c',
      },
    },
  },
  variants: {},
  plugins: [],
};
```

```css
/* src/styles/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定義基礎樣式 */
@layer base {
  body {
    @apply text-gray-800 antialiased;
  }
}

/* 提取可複用組件樣式 */
@layer components {
  .btn {
    @apply px-4 py-2 rounded font-medium transition-colors duration-200;
  }
  .btn-primary {
    @apply bg-primary text-white hover:bg-blue-600;
  }
  .btn-secondary {
    @apply bg-gray-200 text-gray-700 hover:bg-gray-300;
  }
}
```

## 響應式設計

```html
<!-- 移動端優先：默認是 sm，往上加前綴 -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- 手機全寬，平板一半，桌面三分之一 -->
</div>

<!-- 常用斷點 -->
<!-- sm: 640px -->
<!-- md: 768px -->
<!-- lg: 1024px -->
<!-- xl: 1280px -->

<!-- 導航欄響應式 -->
<nav class="flex flex-col md:flex-row md:items-center md:justify-between p-4">
  <div class="text-lg font-bold mb-2 md:mb-0">Logo</div>
  <div class="flex flex-col md:flex-row md:space-x-4">
    <a class="py-2 md:py-0 text-gray-600 hover:text-gray-900">首頁</a>
    <a class="py-2 md:py-0 text-gray-600 hover:text-gray-900">關於</a>
  </div>
</nav>
```

## 在 Vue 組件中使用

```vue
{% raw %}
<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- 卡片網格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="item in items"
        :key="item.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-2">
          {{ item.title }}
        </h3>
        <p class="text-gray-600 text-sm leading-relaxed">
          {{ item.description }}
        </p>
        <div class="mt-4 flex items-center justify-between">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="item.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'"
          >
            {{ item.status === 'active' ? '啓用' : '禁用' }}
          </span>
          <button class="text-primary hover:text-blue-700 text-sm font-medium">
            查看詳情 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
{% endraw %}
```

## 動態類名處理

```vue
<script>
import { computed } from 'vue';

export default {
  props: {
    variant: { type: String, default: 'default' },
    size: { type: String, default: 'md' },
    disabled: Boolean,
  },
  setup(props) {
    const classes = computed(() => [
      'inline-flex items-center justify-center rounded font-medium transition-colors',
      // variant
      {
        'bg-blue-500 text-white hover:bg-blue-600': props.variant === 'primary',
        'bg-gray-200 text-gray-700 hover:bg-gray-300': props.variant === 'default',
        'bg-red-500 text-white hover:bg-red-600': props.variant === 'danger',
      },
      // size
      {
        'px-3 py-1.5 text-sm': props.size === 'sm',
        'px-4 py-2 text-base': props.size === 'md',
        'px-6 py-3 text-lg': props.size === 'lg',
      },
      // state
      { 'opacity-50 cursor-not-allowed': props.disabled },
    ]);

    return { classes };
  },
};
</script>
```

## 生產環境優化

```javascript
// tailwind.config.js
module.exports = {
  // PurgeCSS：移除未使用的樣式
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: [
      './src/**/*.vue',
      './src/**/*.js',
      './src/**/*.html',
    ],
  },
  // ...
};
```

```bash
# 構建後對比
# 未 purge: 3.5MB
# purge 後: 8-15KB（實際使用到的樣式）
```

## 小結

- Tailwind 用原子類替代自定義 CSS，開發效率顯著提升
- 響應式設計用前綴實現，比寫 media query 更直觀
- `@layer components` 提取可複用組件樣式，平衡原子和複用
- 生產環境務必開啓 PurgeCSS，否則體積巨大
- 適合內部工具和快速原型，品牌化項目需要設計系統配合
