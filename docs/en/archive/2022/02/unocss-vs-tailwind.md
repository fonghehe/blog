---
title: "UnoCSS: Redefining the Atomic CSS Engine"
date: 2022-02-22 09:48:37
tags:
  - CSS
  - TailwindCSS
readingTime: 2
description: "Tailwind CSS 统治了原子化 CSS 领域好几年。但 Ant Fu 的 UnoCSS 出现后，格局变了。UnoCSS 不是一个 CSS 框架，而是一个原子化 CSS 引擎——这个定位差异带来了本质上的不同。"
---

Tailwind CSS 统治了原子化 CSS 领域好几年。但 Ant Fu 的 UnoCSS 出现后，格局变了。UnoCSS 不是一个 CSS 框架，而是一个原子化 CSS 引擎——这个定位差异带来了本质上的不同。

## Tailwind 的痛点

Tailwind 有几个实际问题：

1. **文件体积**：`tailwind.css` 生成的文件很大，即使用了 purge
2. **预设不够灵活**：想加自定义规则比较麻烦
3. **运行时 JIT 有性能开销**

UnoCSS 用「按需生成 + 预设系统」解决了这些问题。

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

## 对比用法

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

属性化模式的好处：class 列表不会变得很长，HTML 更干净。

## 自定义规则

这是 UnoCSS 最强大的能力：

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

## Icon 预设：图标方案的终结

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

按需打包，只用到的图标才会生成 CSS。再也不用维护图标字体或 SVG sprite 了。

## Performance Comparison

我们一个中型项目的实测：

| 指标 | Tailwind CSS 3 | UnoCSS |
|------|----------------|--------|
| HMR 样式更新 | 120ms | 5ms |
| 生产 CSS 体积 | 48KB | 12KB |
| 开发服务器启动 | +1.2s | +0.1s |
| 构建时 CSS 生成 | 3.8s | 0.3s |

差距非常明显。UnoCSS 是即时生成（基于字符串匹配），不需要解析 AST。

## 与组件库配合

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

UnoCSS 的定位很巧妙：不和 Tailwind 抢用户，而是提供底层引擎。Tailwind 的规则可以跑在 UnoCSS 上（preset-wind），但 UnoCSS 还有更多可能性——图标、属性化、自定义规则。对于需要高度定制的团队项目，UnoCSS 是更好的选择。