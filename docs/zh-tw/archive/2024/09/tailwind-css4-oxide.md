---
title: "Tailwind CSS 4.0：Oxide 引擎和 CSS-first 配置"
date: 2024-09-05 10:00:00
tags:
  - CSS
  - 工程化
readingTime: 2
description: "Tailwind CSS 4.0 Beta 開放測試了，最大變化是用 Rust 重寫了底層引擎（Oxide），以及把配置從 JS 檔案遷移到 CSS 檔案。"
wordCount: 322
---

Tailwind CSS 4.0 Beta 開放測試了，最大變化是用 Rust 重寫了底層引擎（Oxide），以及把配置從 JS 檔案遷移到 CSS 檔案。

## 速度提升

```
Tailwind 3（Node.js）：完整構建 ~3.5s，增量 ~950ms
Tailwind 4（Oxide/Rust）：完整構建 ~0.1s，增量 ~15ms

增量構建快了 60 倍
```

這個速度提升對大專案意義非常大。

## 安裝

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

## CSS-first 配置

Tailwind 4 的配置直接寫在 CSS 裡：

```css
/* 舊版（tailwind.config.js）*/
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

/* 新版（直接在 CSS 檔案裡）*/
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

然後就可以用這些自定義變數：

```html
<button class="bg-primary hover:bg-primary-dark text-white px-6 py-spacing-18">
  按鈕
</button>
```

## 自動內容檢測

```css
/* Tailwind 3：需要在 config 裡宣告 content 路徑 */
/* content: ['./src/**/*.{html,js,tsx,vue}'] */

/* Tailwind 4：自動檢測！不需要配置 */
@import "tailwindcss";
```

## 新的 CSS 變數 API

```css
/* Tailwind 4 的 CSS 變數直接可用 */
.my-component {
  color: var(--color-primary);
  font-family: var(--font-display);
  padding: var(--spacing-18);
}
```

## 原生 CSS 巢狀支援

```css
/* 現在可以在 @layer 裡用原生 CSS 巢狀 */
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

## 遷移：從 v3 到 v4

大部分類名不變，主要變化：

```html
<!-- 舊版 -->
<div class="bg-opacity-50 text-opacity-75">
  <!-- 新版（用 slash 語法）-->
  <div class="bg-black/50 text-white/75"></div>
</div>
```

```html
<!-- 舊版：shadow 顏色 -->
<div class="shadow-lg shadow-blue-500/50">
  <!-- 新版：一樣的（v3 就支援了）-->
  <div class="shadow-lg shadow-blue-500/50"></div>
</div>
```

官方提供了升級工具：

```bash
npx @tailwindcss/upgrade@next
```

## 我的感受

配置從 JS 遷到 CSS 這個變化剛開始有點不適應，但想想其實更合理：

- CSS 變數天然就是樣式系統的配置項
- 不需要執行 JS 就能獲取配置
- IDE 裡直接可以看到顏色預覽

速度提升是實實在在的，特別是大專案裡增量構建 15ms 這個感受非常好。

## 小結

- Oxide 引擎（Rust）：增量構建快 60 倍
- CSS-first 配置：在 `@theme` 塊裡用 CSS 變數定義主題
- 自動內容檢測：不需要手動配置 `content` 路徑
- 官方升級工具，遷移相對平滑
- 目前還是 Beta，生產環境等正式版
