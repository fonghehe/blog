---
title: "Tailwind CSS 4：全新架構解析"
date: 2025-02-08 13:42:19
tags:
  - CSS
  - 工程化
readingTime: 1
description: "Tailwind CSS 4.0 正式發佈了，這是一次從底層重寫的升級。來聊聊新架構的變化和遷移注意事項。"
wordCount: 208
---

Tailwind CSS 4.0 正式發佈了，這是一次從底層重寫的升級。來聊聊新架構的變化和遷移注意事項。

## 核心變化

```
v3 → v4 的關鍵變化：
  1. 全新的引擎（Oxide），構建速度提升 10x
  2. CSS-first 配置，告別 tailwind.config.js
  3. 原生 cascade layers 支持
  4. 自動 content 檢測，不再需要 content 設定
  5. 新的變體語法（@variant）
  6. CSS 變量全面應用
```

## CSS-first 設定

```css
/* v4: app.css — 直接在 CSS 中配置 */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --font-sans: "Inter", system-ui, sans-serif;
  --breakpoint-3xl: 1920px;

  /* 自定義 spacing */
  --spacing-128: 32rem;
  --spacing-144: 36rem;

  /* 自定義動畫 */
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

```js
// v3: tailwind.config.js — 已經不需要了
module.exports = {
  theme: {
    extend: {
      colors: { primary: '#3b82f6' },
    },
  },
  content: ['./src/**/*.{tsx,ts}'],
}
```

## Vite 集成

```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(), // 替代 postcss
  ],
});
```

構建速度快了非常多，因為不再經過 PostCSS 流水線。

## Cascade Layers

```css
/* v4 自動使用 CSS cascade layers */
/* 優先級順序：
   1. base（重置樣式）
   2. components（組件樣式）
   3. utilities（工具類）
*/

/* 自定義 layer */
@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-lg;
    @apply hover:bg-primary/90 transition-colors;
  }
}
```

這解決了 `!important` 氾濫的問題，工具類天然優先於組件樣式。

## 新變體語法

```html
<!-- 暗色模式 -->
<div class="bg-white dark:bg-gray-900">
  <!-- 響應式 -->
  <p class="text-sm md:text-base lg:text-lg">
    響應式文本
  </p>
  <!-- 容器查詢 -->
  <div class="@container">
    <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
      <!-- 根據容器寬度響應 -->
    </div>
  </div>
</div>
```

## 遷移指南

```bash
# 1. 安裝 v4
npm install tailwindcss@latest @tailwindcss/vite@latest

# 2. 移除 PostCSS 設定
rm postcss.config.js

# 3. 更新 CSS 入口
# 將 tailwind.config.js 的內容遷移到 CSS 的 @theme 塊中

# 4. 運行官方遷移工具
npx @tailwindcss/upgrade
```

## 與 shadcn/ui 的配合

```css
/* 兼容 shadcn/ui 的 CSS 變量 */
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  /* ... 更多變量 */
}
```

shadcn/ui 在 v4 下依然正常工作，隻需調整 CSS 變量的聲明方式。

## 小結

- Tailwind CSS 4 的核心是性能和開發體驗的提升
- CSS-first 配置讓主題管理更直觀
- Oxide 引擎讓構建快了 10 倍
- Cascade Layers 解決了優先級問題
- 與 Vite 的集成更絲滑
- 遷移工具很成熟，大部分項目可以一鍵遷移
