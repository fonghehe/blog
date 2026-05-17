---
title: "Tailwind CSS初体験：アトミックCSS"
date: 2019-11-13 11:08:11
tags:
  - CSS
readingTime: 4
description: "Tailwind CSS 是一个实用优先（Utility-First）的 CSS 框架，它提供了大量原子化的 CSS 类名，让开发者可以直接在 HTML 中组合样式，而不需要编写自定义 CSS。本文将从零开始体验 Tailwind CSS，探索原子化 CSS 的开发模式。"
---

Tailwind CSS 是一个实用优先（Utility-First）的 CSS 框架，它提供了大量原子化的 CSS 类名，让开发者可以直接在 HTML 中组合样式，而不需要编写自定义 CSS。本文将从零开始体验 Tailwind CSS，探索原子化 CSS 的开发模式。

## アトミックCSSとは

传统 CSS 编写方式是为每个组件创建语义化的类名：

```html
<!-- 传统方式 -->
<div class="card">
  <img class="card-image" src="photo.jpg" />
  <div class="card-body">
    <h3 class="card-title">标题</h3>
    <p class="card-text">描述文字</p>
  </div>
</div>

<style>
.card { border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.card-image { width: 100%; height: 200px; object-fit: cover; }
.card-body { padding: 16px; }
.card-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
.card-text { font-size: 14px; color: #666; line-height: 1.5; }
</style>
```

原子化 CSS 使用预定义的小类名来组合样式：

```html
<!-- Tailwind 方式 -->
<div class="rounded-lg shadow-md">
  <img class="w-full h-48 object-cover" src="photo.jpg" />
  <div class="p-4">
    <h3 class="text-lg font-semibold mb-2">标题</h3>
    <p class="text-sm text-gray-600 leading-relaxed">描述文字</p>
  </div>
</div>
```

## インストールと設定

```bash
npm install tailwindcss
```

初始化配置文件：

```bash
npx tailwindcss init
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    // 自定义设计 tokens
    colors: {
      primary: '#3498db',
      secondary: '#2ecc71',
      danger: '#e74c3c',
      gray: {
        100: '#f7fafc',
        200: '#edf2f7',
        300: '#e2e8f0',
        400: '#cbd5e0',
        500: '#a0aec0',
        600: '#718096',
        700: '#4a5568',
        800: '#2d3748',
        900: '#1a202c',
      },
    },
    spacing: {
      '0': '0',
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '5': '20px',
      '6': '24px',
      '8': '32px',
      '10': '40px',
      '12': '48px',
      '16': '64px',
    },
    // 扩展默认配置
    extend: {
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  variants: {},
  plugins: [],
};
```

创建 CSS 入口文件：

```css
/* src/styles/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```bash
# 编译
npx tailwindcss src/styles/tailwind.css -o dist/tailwind.css
```

## ユーティリティクラス早見表

### 布局

```html
<!-- Flexbox -->
<div class="flex items-center justify-between">
  <span>左</span>
  <span>右</span>
</div>

<!-- Grid -->
<div class="grid grid-cols-3 gap-4">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

<!-- 定位 -->
<div class="relative">
  <div class="absolute top-0 right-0">角标</div>
</div>
```

### 间距

```html
<!-- padding: p-4 (16px), px-4 (左右), py-4 (上下), pt-4 (上) -->
<div class="p-4 px-6 py-3 pt-2">

<!-- margin: m-4, mx-auto (水平居中), mt-4 -->
<div class="m-4 mx-auto mt-2">
```

### 字体与颜色

```html
<!-- 字号: text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px) -->
<!-- 字重: font-normal (400), font-medium (500), font-semibold (600), font-bold (700) -->
<h1 class="text-2xl font-bold text-gray-900">大标题</h1>
<p class="text-sm text-gray-600">正文内容</p>
```

### 响应式

```html
<!-- sm: 640px, md: 768px, lg: 1024px, xl: 1280px -->
<div class="w-full md:w-1/2 lg:w-1/3">
  响应式宽度
</div>

<!-- 响应式显示/隐藏 -->
<div class="hidden md:block">
  768px 以上显示
</div>
<div class="block md:hidden">
  768px 以下显示
</div>
```

### Hover / Focus 状态

```html
<button class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded
               focus:outline-none focus:ring-2 focus:ring-blue-300">
  点击我
</button>
```

## @applyでコンポーネントクラスを抽出する

当某组工具类需要复用时，可以用 `@apply` 提取为组件类：

```css
/* styles/components.css */
@layer components {
  .btn {
    @apply px-4 py-2 rounded font-medium transition-colors duration-200;
  }

  .btn-primary {
    @apply bg-blue-500 text-white hover:bg-blue-700;
  }

  .btn-secondary {
    @apply bg-gray-200 text-gray-800 hover:bg-gray-300;
  }

  .card {
    @apply bg-white rounded-lg shadow-md overflow-hidden;
  }

  .input {
    @apply w-full px-3 py-2 border border-gray-300 rounded-md
           focus:outline-none focus:ring-2 focus:ring-blue-500
           focus:border-transparent;
  }
}
```

```html
<button class="btn btn-primary">主要按钮</button>
<button class="btn btn-secondary">次要按钮</button>
```

## Reactでの使い方

```jsx
// Button.jsx
function Button({ variant = 'primary', size = 'md', children, ...props }) {
  const baseClasses = 'font-medium rounded transition-colors focus:outline-none focus:ring-2';

  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-700 focus:ring-blue-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-300',
    danger: 'bg-red-500 text-white hover:bg-red-700 focus:ring-red-300',
  };

  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const className = `${baseClasses} ${variants[variant]} ${sizes[size]}`;

  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}

// 使用
function App() {
  return (
    <div className="p-8 space-y-4">
      <Button variant="primary" size="lg">大号主要按钮</Button>
      <Button variant="danger" size="sm">小号危险按钮</Button>
    </div>
  );
}
```

## BEMとの比較

```html
<!-- BEM: 需要维护 CSS 文件，命名规则严格 -->
<button class="btn btn--primary btn--large">按钮</button>

<style>
.btn { /* 基础样式 */ }
.btn--primary { /* 主要变体 */ }
.btn--large { /* 大号尺寸 */ }
</style>

<!-- Tailwind: 不需要写 CSS，直接在 HTML 中组合 -->
<button class="bg-blue-500 text-white px-6 py-3 text-lg rounded hover:bg-blue-700">
  按钮
</button>
```

## メリット・デメリット分析

### 优点

1. **开发速度快**：不需要想类名，不需要在 CSS 和 HTML 之间切换
2. **不会增长的 CSS**：只有使用的工具类会被生成
3. **响应式简单**：前缀语法 `md:`、`lg:` 非常直观
4. **一致性**：设计系统内置，间距、颜色、字号等都有规范
5. **易于重构**：删除 HTML 元素时不会留下无用的 CSS

### 缺点

1. **学习曲线**：需要记住大量的类名
2. **HTML 可读性**：长类名列表可能影响 HTML 可读性
3. **不适合复杂组件**：高度定制化的组件还是需要自定义 CSS
4. **团队共识**：需要团队接受原子化 CSS 的理念

## ビルドの最適化

```js
// tailwind.config.js - 生产环境优化
module.exports = {
  purge: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {},
  variants: {},
  plugins: [],
};
```

启用 `purge` 后，Tailwind 会在生产构建时移除未使用的类，CSS 文件大小可以从 3MB+ 降到 10KB 以下。

## まとめ

- Tailwind CSS 是实用优先的 CSS 框架，提供大量原子化工具类
- 直接在 HTML/JSX 中组合样式，不需要编写自定义 CSS
- `@apply` 可以将常用组合提取为组件类
- 响应式和状态修饰符使用前缀语法（`md:`、`hover:`）
- `purge` 配置可以大幅减小生产环境的 CSS 体积
- 适合快速原型开发和团队协作
- 需要团队达成共识，接受原子化 CSS 的开发方式
