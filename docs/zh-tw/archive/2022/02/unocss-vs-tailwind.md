---
title: "UnoCSS：重新定義原子化 CSS 的引擎"
date: 2022-02-22 09:48:37
tags:
  - CSS
  - TailwindCSS
readingTime: 2
description: "Tailwind CSS 統治了原子化 CSS 領域好幾年。但 Ant Fu 的 UnoCSS 出現後，格局變了。UnoCSS 不是一個 CSS 框架，而是一個原子化 CSS 引擎——這個定位差異帶來了本質上的不同。"
---

Tailwind CSS 統治了原子化 CSS 領域好幾年。但 Ant Fu 的 UnoCSS 出現後，格局變了。UnoCSS 不是一個 CSS 框架，而是一個原子化 CSS 引擎——這個定位差異帶來了本質上的不同。

## Tailwind 的痛點

Tailwind 有幾個實際問題：

1. **檔案體積**：`tailwind.css` 生成的檔案很大，即使用了 purge
2. **預設不夠靈活**：想加自定義規則比較麻煩
3. **執行時 JIT 有效能開銷**

UnoCSS 用「按需生成 + 預設系統」解決了這些問題。

## 快速上手

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
        // 相容 Tailwind 的預設
        (await import('@unocss/preset-wind')).default(),
        // 屬性化模式
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

## 對比用法

```html
<!-- Tailwind 風格（preset-wind 完全相容） -->
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <h1 class="text-xl font-bold text-gray-800">標題</h1>
  <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    點選
  </button>
</div>

<!-- 屬性化模式（UnoCSS 獨有） -->
<div flex items-center justify-between p-4 bg-white rounded-lg shadow-md>
  <h1 text-xl font-bold text-gray-800>標題</h1>
  <button px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600>
    點選
  </button>
</div>
```

屬性化模式的好處：class 列表不會變得很長，HTML 更乾淨。

## 自定義規則

這是 UnoCSS 最強大的能力：

```typescript
// uno.config.ts
import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  rules: [
    // 簡單規則
    [/^text-(\d+)px$/, ([, d]) => ({ 'font-size': `${d}px` })],

    // 帶主題的規則
    [/^bg-brand$/, (_, { theme }) => ({
      'background-color': theme.colors.brand,
    })],

    // 變體規則
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
    // 快捷方式：組合多個規則
    'btn': 'px-4 py-2 rounded font-medium transition-colors',
    'btn-primary': 'btn bg-brand text-white hover:bg-blue-600',
    'btn-danger': 'btn bg-danger text-white hover:bg-red-600',
    'card': 'p-4 bg-white rounded-lg shadow-sm border border-gray-100',
  },
});
```

```html
<!-- 使用自定義規則 -->
<div class="text-14px bg-brand">自定義字號和品牌色</div>
<div class="text-truncate">超長文本會省略顯示</div>

<!-- 使用 shortcuts -->
<button class="btn-primary">主按鈕</button>
<button class="btn-danger">危險按鈕</button>
```

## Icon 預設：圖示方案的終結

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
<!-- 直接用 class 寫圖示，不需要匯入任何圖示檔案 -->
<i class="i-mdi-home text-2xl text-blue-500"></i>
<i class="i-mdi-account text-xl"></i>
<i class="i-mdi-cog text-lg text-gray-500"></i>
```

按需打包，只用到的圖示才會生成 CSS。再也不用維護圖示字型或 SVG sprite 了。

## 效能對比

我們一箇中型專案的實測：

| 指標 | Tailwind CSS 3 | UnoCSS |
|
------|----------------|--------|
| HMR 樣式更新 | 120ms | 5ms |
| 生產 CSS 體積 | 48KB | 12KB |
| 開發伺服器啟動 | +1.2s | +0.1s |
| 構建時 CSS 生成 | 3.8s | 0.3s |

差距非常明顯。UnoCSS 是即時生成（基於字串匹配），不需要解析 AST。

## 與元件庫配合

```typescript
// uno.config.ts - 為元件庫定義規則
export default defineConfig({
  rules: [
    // 元件字首規則
    [/^cp-btn-(\w+)$/, ([, type]) => ({
      'background-color': `var(--cp-color-${type})`,
      'color': '#fff',
      'border-radius': 'var(--cp-radius)',
      'padding': '8px 16px',
    })],
  ],
  // CSS 變數生成
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

## 小結

UnoCSS 的定位很巧妙：不和 Tailwind 搶使用者，而是提供底層引擎。Tailwind 的規則可以跑在 UnoCSS 上（preset-wind），但 UnoCSS 還有更多可能性——圖示、屬性化、自定義規則。對於需要高度定製的團隊專案，UnoCSS 是更好的選擇。