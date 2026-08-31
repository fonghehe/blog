---
title: "UnoCSS: Redefining the Atomic CSS Engine"
date: 2022-02-22 09:48:37
tags:
  - CSS
  - TailwindCSS
readingTime: 2
description: "Tailwind CSS dominated the atomic CSS space for years. But when Ant Fu's UnoCSS appeared, the landscape changed. UnoCSS is not a CSS framework but an atomic CSS engine — and that positioning difference makes for a fundamental distinction."
wordCount: 265
---

Tailwind CSS has dominated the atomic CSS space for years. But the arrival of Anthony Fu's UnoCSS has changed the landscape. UnoCSS is not a CSS framework but an atomic CSS engine — and that shift in positioning makes all the difference.

## Tailwind's Pain Points

Tailwind has a few real problems:

1. **Bundle size**: even with purge, the generated `tailwind.css` is large.
2. **Inflexible presets**: adding custom rules is cumbersome.
3. **Runtime JIT overhead**.

UnoCSS solves these with on-demand generation plus a preset system.

## Quick Start

```bash
pnpm add -D unocss @unocss/preset-wind @unocss/preset-attributify
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  plugins: [
    UnoCSS({
      presets: [
        // 兼容 Tailwind 的预设
        (await import('@unocss/preset-wind')).default(),
        // 属性化模式
        (await import('@unocss/preset-attributify')).default(),
      ],
    }),
  ],
});
```

```typescript
// main.ts
import 'uno.css';
```

## Comparing the Syntax

```html
<!-- Tailwind 风格（preset-wind 完全兼容） -->
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <h1 class="text-xl font-bold text-gray-800">标题</h1>
  <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    点击
  </button>
</div>

<!-- 属性化模式（UnoCSS 独有） -->
<div flex items-center justify-between p-4 bg-white rounded-lg shadow-md>
  <h1 text-xl font-bold text-gray-800>标题</h1>
  <button px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600>
    点击
  </button>
</div>
```

The advantage of attributify mode is that your class list stays short and your HTML stays clean.

## Custom Rules

This is where UnoCSS is most powerful:

```typescript
// uno.config.ts
import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  rules: [
    // 简单规则
    [/^text-(\d+)px$/, ([, d]) => ({ 'font-size': `${d}px` })],

    // 带主题的规则
    [/^bg-brand$/, (_, { theme }) => ({
      'background-color': theme.colors.brand,
    })],

    // 变体规则
    ['text-truncate', {
      'overflow': 'hidden',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    }],
  ],
  theme: {
    colors: {
      brand: '#1890ff',
      danger: '#ff4d4f',
    },
  },
  shortcuts: {
    // 快捷方式：组合多个规则
    'btn': 'px-4 py-2 rounded font-medium transition-colors',
    'btn-primary': 'btn bg-brand text-white hover:bg-blue-600',
    'btn-danger': 'btn bg-danger text-white hover:bg-red-600',
    'card': 'p-4 bg-white rounded-lg shadow-sm border border-gray-100',
  },
});
```

```html
<!-- 使用自定义规则 -->
<div class="text-14px bg-brand">自定义字号和品牌色</div>
<div class="text-truncate">超长文本会省略显示</div>

<!-- 使用 shortcuts -->
<button class="btn-primary">主按钮</button>
<button class="btn-danger">危险按钮</button>
```

## The Icon Preset: The End of Icon Management

```bash
pnpm add -D @unocss/preset-icons @iconify-json/mdi
```

```typescript
// uno.config.ts
import presetIcons from '@unocss/preset-icons';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
});
```

```html
<!-- 直接用 class 写图标，不需要导入任何图标文件 -->
<i class="i-mdi-home text-2xl text-blue-500"></i>
<i class="i-mdi-account text-xl"></i>
<i class="i-mdi-cog text-lg text-gray-500"></i>
```

Icons are bundled on demand — only the ones you actually use get compiled into CSS. You no longer have to maintain an icon font or an SVG sprite.

## Performance Comparison

Here are measurements from a mid-sized project of ours:

| Metric | Tailwind CSS 3 | UnoCSS |
|--------|----------------|--------|
| HMR style update | 120ms | 5ms |
| Production CSS size | 48KB | 12KB |
| Dev server startup | +1.2s | +0.1s |
| CSS generation at build | 3.8s | 0.3s |

The gap is striking. UnoCSS generates styles on the fly (by string matching) and never has to parse an AST.

## Working with Component Libraries

```typescript
// uno.config.ts - 为组件库定义规则
export default defineConfig({
  rules: [
    // 组件前缀规则
    [/^cp-btn-(\w+)$/, ([, type]) => ({
      'background-color': `var(--cp-color-${type})`,
      'color': '#fff',
      'border-radius': 'var(--cp-radius)',
      'padding': '8px 16px',
    })],
  ],
  // CSS 变量生成
  preflights: [
    {
      getCSS: () => `
        :root {
          --cp-color-primary: #1890ff;
          --cp-color-danger: #ff4d4f;
          --cp-radius: 6px;
        }
      `,
    },
  ],
});
```

## Summary

UnoCSS is cleverly positioned: instead of competing with Tailwind for users, it provides the underlying engine. Tailwind's rules can run on top of UnoCSS (via preset-wind), yet UnoCSS opens up far more — icons, attributify mode, and custom rules. For team projects that need heavy customization, UnoCSS is the better choice.
