---
title: "Tailwind CSS 実践ガイド"
date: 2020-10-06 14:38:55
tags:
  - CSS
readingTime: 3
description: "Tailwind CSS はこの 2 年でますます人気が高まり、最近内部ツールプロジェクトで試用してみました。「この書き方は変だ」から「やっぱり便利だ」まで、実際の使用感を記録します。"
wordCount: 347
---

Tailwind CSS はこの 2 年でますます人気が高まり、最近内部ツールプロジェクトで試用してみました。「この書き方は変だ」から「やっぱり便利だ」まで、実際の使用感を記録します。

## CSSファイル間の行き来とはおさらば

```html
<!-- 传统写法：HTML 和 CSS 分离 -->
<div class="card">
  <h2 class="card-title">标题</h2>
  <p class="card-desc">描述文字</p>
</div>

<!-- 需要打开 CSS 文件看 card-title 具体是什么 -->
<!-- .card-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; } -->

<!-- Tailwind 写法：样式直接写在 HTML 里 -->
<div class="bg-white rounded-lg shadow p-6">
  <h2 class="text-xl font-semibold mb-2">标题</h2>
  <p class="text-gray-600">描述文字</p>
</div>

<!-- 一眼就知道什么样式，不用跳文件 -->
```

## インストールと設定

```bash
# Vue CLI 项目
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

/* 自定义基础样式 */
@layer base {
  body {
    @apply text-gray-800 antialiased;
  }
}

/* 提取可复用组件样式 */
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

## レスポンシブデザイン

```html
<!-- 移动端优先：默认是 sm，往上加前缀 -->
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- 手机全宽，平板一半，桌面三分之一 -->
</div>

<!-- 常用断点 -->
<!-- sm: 640px -->
<!-- md: 768px -->
<!-- lg: 1024px -->
<!-- xl: 1280px -->

<!-- 导航栏响应式 -->
<nav class="flex flex-col md:flex-row md:items-center md:justify-between p-4">
  <div class="text-lg font-bold mb-2 md:mb-0">Logo</div>
  <div class="flex flex-col md:flex-row md:space-x-4">
    <a class="py-2 md:py-0 text-gray-600 hover:text-gray-900">首页</a>
    <a class="py-2 md:py-0 text-gray-600 hover:text-gray-900">关于</a>
  </div>
</nav>
```

## Vueコンポーネントでの使用

```vue
{% raw %}
<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- 卡片网格 -->
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
            {{ item.status === 'active' ? '启用' : '禁用' }}
          </span>
          <button class="text-primary hover:text-blue-700 text-sm font-medium">
            查看详情 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
{% endraw %}
```

## 動的クラス名の処理

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

## 本番環境の最適化

```javascript
// tailwind.config.js
module.exports = {
  // PurgeCSS：移除未使用的样式
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
# ビルド後の比較
# purge 前: 3.5MB
# purge 後: 8-15KB（実際に使用されるスタイル）
```

## まとめ

- Tailwind は原子クラスでカスタム CSS を置き換え、開発効率が大幅に向上します。
- レスポンシブデザインはプレフィックスで実現し、media query を書くより直感的です。
- `@layer components` で再利用可能なコンポーネントスタイルを抽出し、原子性と再利用性のバランスを取ります。
- 本番環境では必ず PurgeCSS を有効にしてください。そうしないとファイルサイズが巨大になります。
- 内部ツールや高速プロトタイピングに適しています。ブランド化されたプロジェクトではデザインシステムとの連携が必要です。
