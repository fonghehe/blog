---
title: "2022 年終盤點：前端工具鏈的格局之變"
date: 2022-12-20 11:47:19
tags:
  - 前端
readingTime: 3
description: "2022 年是前端工具鏈劇烈變化的一年。Vite 成為主流構建工具、pnnpm + Turborepo 定義了 monorepo 的標準方案、ESM 遷移進入實質階段。這篇文章做個年終總結。"
---

2022 年是前端工具鏈劇烈變化的一年。Vite 成為主流構建工具、pnnpm + Turborepo 定義了 monorepo 的標準方案、ESM 遷移進入實質階段。這篇文章做個年終總結。

## 構建工具：Vite 統一了開發體驗

年初我們還在用 Webpack，年底所有新項目都跑在 Vite 上。

```typescript
// 2022 年初的 Webpack 配置
module.exports = {
  entry: './src/index.tsx',
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  devServer: { port: 3000 },
  // 啓動耗時：45 秒
};

// 2022 年底的 Vite 配置
export default defineConfig({
  plugins: [react()],
  // 啓動耗時：2 秒
});
```

Vite 3 的發佈鞏固了它的地位。esbuild 做依賴預構建、原生 ESM 做開發模式——這個架構被證明是正確的。

## Monorepo：pnpm + Turborepo 組合

2022 年我們完成了 monorepo 的標準化：

| 工具 | 職責 |
|
------|------|
| pnpm | 依賴管理、workspace 管理 |
| Turborepo | 構建編排、緩存 |
| Changesets | 版本管理、發佈 |
| TypeScript Project References | 類型檢查 |

```json
// 一個典型的前端 monorepo
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "release": "changeset publish"
  }
}
```

## 測試：Vitest 接棒 Jest

Vitest 的優勢太明顯了——和 Vite 共享配置、原生 ESM、速度快 3 倍。我們把 5 個項目從 Jest 遷移到 Vitest，平均耗時半天。

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

## CSS 方案：UnoCSS 崛起

Tailwind 仍然主導市場，但 UnoCSS 在我們團隊獲得了更好的體驗：

- 按需生成，CSS 體積更小
- 圖標預設解決了圖標管理問題
- 自定義規則能力讓組件庫樣式更靈活

```html
<!-- UnoCSS：屬性化模式 + 圖標預設 -->
<button px-4 py-2 bg-blue-500 text-white rounded>
  <i class="i-mdi-check mr-2"></i>
  確認
</button>
```

## 運行時：三方混戰

```
Node.js 18 LTS  —— 生產環境的標準
Deno 1.x       —— 邊緣計算和實驗
Bun 0.1.x      —— 令人興奮的挑戰者
```

Node.js 18 內置 fetch 和測試運行器，減少了對第三方依賴的需求。Bun 的速度表現令人印象深刻，但還不適合生產環境。

## 框架生態

```
React 18    —— 併發特性落地（useTransition, useDeferredValue）
Next.js 13  —— App Router 預覽（Server Components）
Vue 3.2     —— 穩定成熟，生態豐富
SvelteKit   —— 全棧能力
Astro 1.0   —— 內容站首選
Solid.js    —— 性能標杆
```

React 18 的併發特性讓性能優化從「手動優化」變成「框架幫你優化」。Next.js 13 的 App Router 預示了 SSR 的未來方向。

## TypeScript

TypeScript 從 4.6 演進到 4.9，每一步都在解決實際問題：

- 4.6：解構不破壞控制流
- 4.7：ESM 支持（module: NodeNext）
- 4.8：類型收窄增強
- 4.9：satisfies 操作符

```typescript
// satisfies 是今年最好的 TypeScript 特性
const routes = {
  '/': HomePage,
  '/about': AboutPage,
  '/users/[id]': UserPage,
} satisfies Record<string, ComponentType>;

// routes['/'] 的類型是 ComponentType，不是泛化的 ComponentType
```

## 我的 2022 推薦工具鏈

```json
{
  "runtime": "Node.js 18",
  "packageManager": "pnpm 7",
  "monorepo": "pnpm workspace + Turborepo",
  "bundler": "Vite 3",
  "testing": "Vitest",
  "css": "UnoCSS",
  "framework": "React 18 / Next.js 13",
  "language": "TypeScript 4.9"
}
```

## 展望 2023

幾個值得關注的方向：
1. **Bun 正式版**：能否改變 JavaScript 工具鏈格局
2. **Next.js 13 穩定版**：App Router 是否能被廣泛接受
3. **Rust 工具鏈**：SWC、Rspack、Biome 等基於 Rust 的工具
4. **CSS 新特性**：Container Queries 廣泛落地

## 小結

2022 年前端工具鏈的主題是「收斂」——Vite 統一構建、pnpm 統一包管理、Vitest 統一測試。碎片化在減少，開發者體驗在提升。作為基礎設施搭建者，今年的工作讓團隊的開發效率有了質的飛躍。