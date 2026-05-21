---
title: "Tailwind CSS 4：全新架构解析"
date: 2025-02-08 10:00:00
tags:
  - CSS
  - 工程化
readingTime: 1
description: "Tailwind CSS 4.0 正式发布了，这是一次从底层重写的升级。来聊聊新架构的变化和迁移注意事项。"
wordCount: 208
---

Tailwind CSS 4.0 正式发布了，这是一次从底层重写的升级。来聊聊新架构的变化和迁移注意事项。

## 核心变化

```
v3 → v4 的关键变化：
  1. 全新的引擎（Oxide），构建速度提升 10x
  2. CSS-first 配置，告别 tailwind.config.js
  3. 原生 cascade layers 支持
  4. 自动 content 检测，不再需要 content 配置
  5. 新的变体语法（@variant）
  6. CSS 变量全面应用
```

## CSS-first 配置

```css
/* v4: app.css — 直接在 CSS 中配置 */
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --font-sans: "Inter", system-ui, sans-serif;
  --breakpoint-3xl: 1920px;

  /* 自定义 spacing */
  --spacing-128: 32rem;
  --spacing-144: 36rem;

  /* 自定义动画 */
  --animate-fade-in: fade-in 0.3s ease-out;

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

```js
// v3: tailwind.config.js — 已经不需要了
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

构建速度快了非常多，因为不再经过 PostCSS 流水线。

## Cascade Layers

```css
/* v4 自动使用 CSS cascade layers */
/* 优先级顺序：
   1. base（重置样式）
   2. components（组件样式）
   3. utilities（工具类）
*/

/* 自定义 layer */
@layer components {
  .btn-primary {
    @apply bg-primary text-white px-4 py-2 rounded-lg;
    @apply hover:bg-primary/90 transition-colors;
  }
}
```

这解决了 `!important` 泛滥的问题，工具类天然优先于组件样式。

## 新变体语法

```html
<!-- 暗色模式 -->
<div class="bg-white dark:bg-gray-900">
  <!-- 响应式 -->
  <p class="text-sm md:text-base lg:text-lg">
    响应式文本
  </p>
  <!-- 容器查询 -->
  <div class="@container">
    <div class="grid grid-cols-1 @md:grid-cols-2 @lg:grid-cols-3">
      <!-- 根据容器宽度响应 -->
    </div>
  </div>
</div>
```

## 迁移指南

```bash
# 1. 安装 v4
npm install tailwindcss@latest @tailwindcss/vite@latest

# 2. 移除 PostCSS 配置
rm postcss.config.js

# 3. 更新 CSS 入口
# 将 tailwind.config.js 的内容迁移到 CSS 的 @theme 块中

# 4. 运行官方迁移工具
npx @tailwindcss/upgrade
```

## 与 shadcn/ui 的配合

```css
/* 兼容 shadcn/ui 的 CSS 变量 */
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  /* ... 更多变量 */
}
```

shadcn/ui 在 v4 下依然正常工作，只需调整 CSS 变量的声明方式。

## 小结

- Tailwind CSS 4 的核心是性能和开发体验的提升
- CSS-first 配置让主题管理更直观
- Oxide 引擎让构建快了 10 倍
- Cascade Layers 解决了优先级问题
- 与 Vite 的集成更丝滑
- 迁移工具很成熟，大部分项目可以一键迁移
