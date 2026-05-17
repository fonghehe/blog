---
title: "Tailwind CSS 4.0：Oxide エンジンと CSS-first 設定"
date: 2024-09-05 10:00:00
tags:
  - CSS
  - エンジニアリング
readingTime: 2
description: "Tailwind CSS 4.0 Beta 开放测试了，最大变化是用 Rust 重写了底层引擎（Oxide），以及把配置从 JS 文件迁移到 CSS 文件。"
---

Tailwind CSS 4.0 Beta 开放测试了，最大变化是用 Rust 重写了底层引擎（Oxide），以及把配置从 JS 文件迁移到 CSS 文件。

## スピード向上

```
Tailwind 3（Node.js）：完整构建 ~3.5s，增量 ~950ms
Tailwind 4（Oxide/Rust）：完整构建 ~0.1s，增量 ~15ms

增量构建快了 60 倍
```

这个速度提升对大项目意义非常大。

## インストール

```bash
npm install tailwindcss@next @tailwindcss/vite@next
```

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";

export default {
  plugins: [tailwindcss()],
};
```

注意：不再需要 `postcss.config.js`！

## CSS-ファースト設定

Tailwind 4 的配置直接写在 CSS 里：

```css
/* 旧版（tailwind.config.js）*/
/*
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
      }
    }
  }
}
*/

/* 新版（直接在 CSS 文件里）*/
@import "tailwindcss";

@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #1d4ed8;

  --font-display: "Inter", sans-serif;

  --spacing-18: 4.5rem;
  --spacing-22: 5.5rem;

  --breakpoint-xs: 475px;
}
```

然后就可以用这些自定义变量：

```html
<button class="bg-primary hover:bg-primary-dark text-white px-6 py-spacing-18">
  按钮
</button>
```

## 自動コンテンツ検出

```css
/* Tailwind 3：需要在 config 里声明 content 路径 */
/* content: ['./src/**/*.{html,js,tsx,vue}'] */

/* Tailwind 4：自动检测！不需要配置 */
@import "tailwindcss";
```

## 新しいCSS変数API

```css
/* Tailwind 4 的 CSS 变量直接可用 */
.my-component {
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: var(--spacing-18);
}
```

## ネイティブCSSネストサポート

```css
/* 现在可以在 @layer 里用原生 CSS 嵌套 */
@layer components {
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;

    &:hover {
      opacity: 0.9;
    }

    &.btn-primary {
      background-color: var(--color-primary);
      color: white;
    }
  }
}
```

## 移行：v3からv4へ

大部分类名不变，主要变化：

```html
<!-- 旧版 -->
<div class="bg-opacity-50 text-opacity-75">
  <!-- 新版（用 slash 语法）-->
  <div class="bg-black/50 text-white/75"></div>
</div>
```

```html
<!-- 旧版：shadow 颜色 -->
<div class="shadow-lg shadow-blue-500/50">
  <!-- 新版：一样的（v3 就支持了）-->
  <div class="shadow-lg shadow-blue-500/50"></div>
</div>
```

官方提供了升级工具：

```bash
npx @tailwindcss/upgrade@next
```

## 所感

配置从 JS 迁到 CSS 这个变化刚开始有点不适应，但想想其实更合理：

- CSS 变量天然就是样式系统的配置项
- 不需要运行 JS 就能获取配置
- IDE 里直接可以看到颜色预览

速度提升是实实在在的，特别是大项目里增量构建 15ms 这个感受非常好。

## まとめ

- Oxide 引擎（Rust）：增量构建快 60 倍
- CSS-first 配置：在 `@theme` 块里用 CSS 变量定义主题
- 自动内容检测：不需要手动配置 `content` 路径
- 官方升级工具，迁移相对平滑
- 目前还是 Beta，生产环境等正式版
