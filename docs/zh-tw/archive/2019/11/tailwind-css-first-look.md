---
title: "Tailwind CSS 初體驗原子化 CSS"
date: 2019-11-13 11:08:11
tags:
  - CSS
readingTime: 4
description: "Tailwind CSS 是一個實用優先（Utility-First）的 CSS 框架，它提供了大量原子化的 CSS 類名，讓開發者可以直接在 HTML 中組合樣式，而不需要編寫自定義 CSS。本文將從零開始體驗 Tailwind CSS，探索原子化 CSS 的開發模式。"
wordCount: 562
---

Tailwind CSS 是一個實用優先（Utility-First）的 CSS 框架，它提供了大量原子化的 CSS 類名，讓開發者可以直接在 HTML 中組合樣式，而不需要編寫自定義 CSS。本文將從零開始體驗 Tailwind CSS，探索原子化 CSS 的開發模式。

## 什麼是原子化 CSS

傳統 CSS 編寫方式是為每個元件建立語義化的類名：

```html
<!-- 傳統方式 -->
<div class="card">
  <img class="card-image" src="photo.jpg" />
  <div class="card-body">
    <h3 class="card-title">標題</h3>
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

原子化 CSS 使用預定義的小類名來組合樣式：

```html
<!-- Tailwind 方式 -->
<div class="rounded-lg shadow-md">
  <img class="w-full h-48 object-cover" src="photo.jpg" />
  <div class="p-4">
    <h3 class="text-lg font-semibold mb-2">標題</h3>
    <p class="text-sm text-gray-600 leading-relaxed">描述文字</p>
  </div>
</div>
```

## 安裝與設定

```bash
npm install tailwindcss
```

初始化配置檔案：

```bash
npx tailwindcss init
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    // 自定義設計 tokens
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
    // 擴充套件預設配置
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

建立 CSS 入口檔案：

```css
/* src/styles/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```bash
# 編譯
npx tailwindcss src/styles/tailwind.css -o dist/tailwind.css
```

## 常用工具類速查

### 佈局

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
  <div class="absolute top-0 right-0">角標</div>
</div>
```

### 間距

```html
<!-- padding: p-4 (16px), px-4 (左右), py-4 (上下), pt-4 (上) -->
<div class="p-4 px-6 py-3 pt-2">

<!-- margin: m-4, mx-auto (水平居中), mt-4 -->
<div class="m-4 mx-auto mt-2">
```

### 字型與顏色

```html
<!-- 字號: text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px) -->
<!-- 字重: font-normal (400), font-medium (500), font-semibold (600), font-bold (700) -->
<h1 class="text-2xl font-bold text-gray-900">大標題</h1>
<p class="text-sm text-gray-600">正文內容</p>
```

### 響應式

```html
<!-- sm: 640px, md: 768px, lg: 1024px, xl: 1280px -->
<div class="w-full md:w-1/2 lg:w-1/3">
  響應式寬度
</div>

<!-- 響應式顯示/隱藏 -->
<div class="hidden md:block">
  768px 以上顯示
</div>
<div class="block md:hidden">
  768px 以下顯示
</div>
```

### Hover / Focus 狀態

```html
<button class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded
               focus:outline-none focus:ring-2 focus:ring-blue-300">
  點選我
</button>
```

## 使用 @apply 提取元件類

當某組工具類需要複用時，可以用 `@apply` 提取為元件類：

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
<button class="btn btn-primary">主要按鈕</button>
<button class="btn btn-secondary">次要按鈕</button>
```

## 在 React 中使用

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
      <Button variant="primary" size="lg">大號主要按鈕</Button>
      <Button variant="danger" size="sm">小號危險按鈕</Button>
    </div>
  );
}
```

## 與 BEM 的對比

```html
<!-- BEM: 需要維護 CSS 檔案，命名規則嚴格 -->
<button class="btn btn--primary btn--large">按鈕</button>

<style>
.btn { /* 基礎樣式 */ }
.btn--primary { /* 主要變體 */ }
.btn--large { /* 大號尺寸 */ }
</style>

<!-- Tailwind: 不需要寫 CSS，直接在 HTML 中組合 -->
<button class="bg-blue-500 text-white px-6 py-3 text-lg rounded hover:bg-blue-700">
  按鈕
</button>
```

## 優缺點分析

### 優點

1. **開發速度快**：不需要想類名，不需要在 CSS 和 HTML 之間切換
2. **不會增長的 CSS**：隻有使用的工具類會被生成
3. **響應式簡單**：字首語法 `md:`、`lg:` 非常直觀
4. **一致性**：設計系統內建，間距、顏色、字號等都有規範
5. **易於重構**：刪除 HTML 元素時不會留下無用的 CSS

### 缺點

1. **學習曲線**：需要記住大量的類名
2. **HTML 可讀性**：長類名列表可能影響 HTML 可讀性
3. **不適合複雜元件**：高度定製化的元件還是需要自定義 CSS
4. **團隊共識**：需要團隊接受原子化 CSS 的理念

## 構建最佳化

```js
// tailwind.config.js - 生產環境最佳化
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

啟用 `purge` 後，Tailwind 會在生產構建時移除未使用的類，CSS 檔案大小可以從 3MB+ 降到 10KB 以下。

## 小結

- Tailwind CSS 是實用優先的 CSS 框架，提供大量原子化工具類
- 直接在 HTML/JSX 中組合樣式，不需要編寫自定義 CSS
- `@apply` 可以將常用組合提取為元件類
- 響應式和狀態修飾符使用字首語法（`md:`、`hover:`）
- `purge` 配置可以大幅減小生產環境的 CSS 體積
- 適合快速原型開發和團隊協作
- 需要團隊達成共識，接受原子化 CSS 的開發方式
