---
title: "CSS View Transitions Level 2：跨文檔動畫實戰"
date: 2026-03-27 10:00:00
tags:
  - CSS
readingTime: 2
description: "CSS View Transitions Level 1 讓單頁應用（SPA）的頁面切換動畫變得優雅。而 2026 年正式進入各大瀏覽器穩定通道的 **View Transitions Level 2**，將這一能力擴展到了多頁應用（MPA）——無需 JavaScript 框架，純 CSS + HTML 即可實現流暢的"
wordCount: 450
---

CSS View Transitions Level 1 讓單頁應用（SPA）的頁面切換動畫變得優雅。而 2026 年正式進入各大瀏覽器穩定通道的 **View Transitions Level 2**，將這一能力擴展到了多頁應用（MPA）——無需 JavaScript 框架，純 CSS + HTML 即可實現流暢的跨文檔過渡動畫。

## Level 1 回顧：SPA 中的視圖過渡

在此之前，SPA 框架通常這樣使用 View Transitions：

```typescript
// React Router / Next.js 的路由切換動畫
async function navigate(url: string) {
  if (!document.startViewTransition) {
    window.location.href = url;
    return;
  }

  await document.startViewTransition(async () => {
    await router.push(url);
  });
}
```

```css
/* 默認的淡入淡出 */
::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}
::view-transition-new(root) {
  animation: 200ms ease-in fade-in;
}
```

## Level 2：MPA 跨文檔過渡

Level 2 的核心突破是讓普通多頁網站也能實現無縫導航動畫，只需在 CSS 中聲明：

```css
/* 在 <head> 中的全局樣式裏添加 */
@view-transition {
  navigation: auto; /* 告訴瀏覽器對普通導航啓用視圖過渡 */
}
```

就這一行，所有頁面間的導航都會自動獲得淡入淡出效果。

## 命名元素過渡：英雄動畫

Level 2 最強大的功能是跨文檔的"英雄動畫"（hero animation）——同一元素在不同頁面間的連續過渡：

```css
/* 列表頁：給商品卡片命名 */
.product-card[data-id="42"] {
  view-transition-name: product-42;
}

/* 或者用 CSS 自定義屬性動態生成名字 */
.product-card {
  view-transition-name: var(--product-id);
}
```

```html
<!-- 列表頁 -->
<div class="product-card" style="--product-id: product-42" data-id="42">
  <img src="product-42.jpg" alt="商品圖片" />
  <h2>商品名稱</h2>
</div>

<!-- 詳情頁：使用相同的 view-transition-name -->
<div class="product-hero" style="view-transition-name: product-42">
  <img src="product-42.jpg" alt="商品圖片" />
</div>
```

瀏覽器會自動計算兩個元素的位置、大小差異，生成流暢的 FLIP 動畫。

## 精細控制過渡動畫

```css
/* 針對特定命名元素的過渡 */
::view-transition-old(product-42) {
  animation: 300ms ease-in scale-out;
}
::view-transition-new(product-42) {
  animation: 300ms ease-out scale-in;
}

@keyframes scale-out {
  to {
    transform: scale(1.1);
    opacity: 0;
  }
}
@keyframes scale-in {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
}

/* 其他元素用滑動效果 */
::view-transition-old(root) {
  animation: 250ms ease-out slide-left;
}
::view-transition-new(root) {
  animation: 250ms ease-out slide-right;
}
```

## 響應用户偏好

```css
/* 尊重用户的減少動畫偏好 */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: auto;
  }

  /* 降級為簡單淡入淡出或直接禁用 */
  ::view-transition-group(*) {
    animation-duration: 0.01ms !important;
  }
}
```

## 在 Next.js / Nuxt 中集成

以 Next.js App Router 為例：

```typescript
// app/layout.tsx
import './view-transitions.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        {/* Level 2 的 MPA 模式通過 CSS 啓用，無需額外 JS */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```css
/* view-transitions.css */
@view-transition {
  navigation: auto;
}

/* 頁面級默認動畫 */
::view-transition-old(root) {
  animation: 200ms ease-out both fade-slide-out;
}
::view-transition-new(root) {
  animation: 200ms ease-out both fade-slide-in;
}

@keyframes fade-slide-out {
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
```

## 瀏覽器支持狀況（2026 年初）

| 瀏覽器       | Level 1 | Level 2 (跨文檔) |
| ------------ | ------- | ---------------- |
| Chrome 133+  | ✅      | ✅               |
| Firefox 132+ | ✅      | ✅               |
| Safari 18.3+ | ✅      | ✅               |
| Edge 133+    | ✅      | ✅               |

2026 年初，全球瀏覽器覆蓋率已超過 92%，可以在生產環境放心使用，以 `@supports` 作為漸進增強的後備。

## 總結

CSS View Transitions Level 2 填補了多頁應用動畫的最後一塊拼圖。不再需要 JavaScript 框架介入，不再需要手動管理動畫狀態，只需幾行 CSS 聲明，你的網站就能擁有媲美原生應用的頁面過渡體驗。對於 2026 年新建的 MPA 項目，這應該是默認啓用的標配功能。
