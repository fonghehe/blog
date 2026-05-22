---
title: "UnoCSS：アトミック CSS エンジンの再定義"
date: 2022-02-22 09:48:37
tags:
  - CSS
  - TailwindCSS
readingTime: 3
description: "Tailwind CSS は長年にわたりアトミック CSS の領域を支配してきました。しかし、Ant Fu の UnoCSS が登場してから状況は変わりました。UnoCSS は CSS フレームワークではなく、アトミック CSS エンジンです——このポジショニングの違いが本質的に異なるものをもたらしています。"
wordCount: 646
---

Tailwind CSS は長年にわたりアトミック CSS の領域を支配してきました。しかし、Ant Fu の UnoCSS が登場してから状況は変わりました。UnoCSS は CSS フレームワークではなく、アトミック CSS エンジンです——このポジショニングの違いが本質的に異なるものをもたらしています。

## Tailwind 的痛点

Tailwind にはいくつかの実際的な問題があります：

1. **ファイルサイズ**：`tailwind.css` が生成するファイルは purge を使用しても大きい
2. **プリセットの柔軟性不足**：カスタムルールの追加が面倒
3. **実行時 JIT にパフォーマンスオーバーヘッドがある**

UnoCSS は「オンデマンド生成 + プリセットシステム」でこれらの問題を解決しました。

## クイックスタート

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
        // Tailwind 互換のプリセット
        (await import('@unocss/preset-wind')).default(),
        // 属性化モード
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

属性化モードの利点：class リストが長くなりすぎず、HTML がよりクリーンになります。

## 自定义规则

これが UnoCSS の最も強力な能力です：

```typescript
// uno.config.ts
import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  rules: [
    // シンプルなルール
    [/^text-(\d+)px$/, ([, d]) => ({ 'font-size': `${d}px` })],

    // テーマ付きのルール
    [/^bg-brand$/, (_, { theme }) => ({
      'background-color': theme.colors.brand,
    })],

    // バリアントルール
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
    // ショートカット：複数のルールを組み合わせる
    'btn': 'px-4 py-2 rounded font-medium transition-colors',
    'btn-primary': 'btn bg-brand text-white hover:bg-blue-600',
    'btn-danger': 'btn bg-danger text-white hover:bg-red-600',
    'card': 'p-4 bg-white rounded-lg shadow-sm border border-gray-100',
  },
});
```

```html
<!-- カスタムルールの使用 -->
<div class="text-14px bg-brand">自定义字号和品牌色</div>
<div class="text-truncate">超长文本会省略显示</div>

<!-- shortcuts の使用 -->
<button class="btn-primary">主按钮</button>
<button class="btn-danger">危险按钮</button>
```

## Icon プリセット：アイコンソリューションの終着点

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
<!-- class で直接アイコンを記述し、アイコンファイルのインポートは不要 -->
<i class="i-mdi-home text-2xl text-blue-500"></i>
<i class="i-mdi-account text-xl"></i>
<i class="i-mdi-cog text-lg text-gray-500"></i>
```

オンデマンドでバンドルされ、使用したアイコンのみ CSS が生成されます。もはやアイコンフォントや SVG sprite を維持する必要はありません。

## パフォーマンス比較

ある中規模プロジェクトでの実測：

| 指標 | Tailwind CSS 3 | UnoCSS |
|------|----------------|--------|
| HMR 样式更新 | 120ms | 5ms |
| 生产 CSS 体积 | 48KB | 12KB |
| 开发服务器启动 | +1.2s | +0.1s |
| 构建时 CSS 生成 | 3.8s | 0.3s |

その差は非常に顕著です。UnoCSS は即時生成（文字列マッチングベース）であり、AST の解析が不要です。

## コンポーネントライブラリとの連携

```typescript
// uno.config.ts - コンポーネントライブラリのルールを定義
export default defineConfig({
  rules: [
    // コンポーネント接頭辞ルール
    [/^cp-btn-(\w+)$/, ([, type]) => ({
      'background-color': `var(--cp-color-${type})`,
      'color': '#fff',
      'border-radius': 'var(--cp-radius)',
      'padding': '8px 16px',
    })],
  ],
  // CSS 変数の生成
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

## まとめ

UnoCSS のポジショニングは非常に巧妙です：Tailwind からユーザーを奪うのではなく、基盤エンジンを提供します。Tailwind のルールは UnoCSS 上で動作し（preset-wind）、さらに UnoCSS にはアイコン、属性化、カスタムルールなど、さらなる可能性があります。高度なカスタマイズが必要なチームプロジェクトには、UnoCSS がより良い選択肢です。