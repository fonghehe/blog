---
title: "CSS View Transitions Level 2：跨文档动画实战"
date: 2026-03-27 10:00:00
tags:
  - CSS
readingTime: 2
description: "CSS View Transitions Level 1 让单页应用（SPA）的页面切换动画变得优雅。而 2026 年正式进入各大浏览器稳定通道的 **View Transitions Level 2**，将这一能力扩展到了多页应用（MPA）——无需 JavaScript 框架，纯 CSS + HTML 即可实现流畅的"
wordCount: 450
---

CSS View Transitions Level 1 让单页应用（SPA）的页面切换动画变得优雅。而 2026 年正式进入各大浏览器稳定通道的 **View Transitions Level 2**，将这一能力扩展到了多页应用（MPA）——无需 JavaScript 框架，纯 CSS + HTML 即可实现流畅的跨文档过渡动画。

## Level 1 回顾：SPA 中的视图过渡

在此之前，SPA 框架通常这样使用 View Transitions：

```typescript
// React Router / Next.js 的路由切换动画
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
/* 默认的淡入淡出 */
::view-transition-old(root) {
  animation: 200ms ease-out fade-out;
}
::view-transition-new(root) {
  animation: 200ms ease-in fade-in;
}
```

## Level 2：MPA 跨文档过渡

Level 2 的核心突破是让普通多页网站也能实现无缝导航动画，只需在 CSS 中声明：

```css
/* 在 <head> 中的全局样式里添加 */
@view-transition {
  navigation: auto; /* 告诉浏览器对普通导航启用视图过渡 */
}
```

就这一行，所有页面间的导航都会自动获得淡入淡出效果。

## 命名元素过渡：英雄动画

Level 2 最强大的功能是跨文档的"英雄动画"（hero animation）——同一元素在不同页面间的连续过渡：

```css
/* 列表页：给商品卡片命名 */
.product-card[data-id="42"] {
  view-transition-name: product-42;
}

/* 或者用 CSS 自定义属性动态生成名字 */
.product-card {
  view-transition-name: var(--product-id);
}
```

```html
<!-- 列表页 -->
<div class="product-card" style="--product-id: product-42" data-id="42">
  <img src="product-42.jpg" alt="商品图片" />
  <h2>商品名称</h2>
</div>

<!-- 详情页：使用相同的 view-transition-name -->
<div class="product-hero" style="view-transition-name: product-42">
  <img src="product-42.jpg" alt="商品图片" />
</div>
```

浏览器会自动计算两个元素的位置、大小差异，生成流畅的 FLIP 动画。

## 精细控制过渡动画

```css
/* 针对特定命名元素的过渡 */
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

/* 其他元素用滑动效果 */
::view-transition-old(root) {
  animation: 250ms ease-out slide-left;
}
::view-transition-new(root) {
  animation: 250ms ease-out slide-right;
}
```

## 响应用户偏好

```css
/* 尊重用户的减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: auto;
  }

  /* 降级为简单淡入淡出或直接禁用 */
  ::view-transition-group(*) {
    animation-duration: 0.01ms !important;
  }
}
```

## 在 Next.js / Nuxt 中集成

以 Next.js App Router 为例：

```typescript
// app/layout.tsx
import './view-transitions.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        {/* Level 2 的 MPA 模式通过 CSS 启用，无需额外 JS */}
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

/* 页面级默认动画 */
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

## 浏览器支持状况（2026 年初）

| 浏览器       | Level 1 | Level 2 (跨文档) |
| ------------ | ------- | ---------------- |
| Chrome 133+  | ✅      | ✅               |
| Firefox 132+ | ✅      | ✅               |
| Safari 18.3+ | ✅      | ✅               |
| Edge 133+    | ✅      | ✅               |

2026 年初，全球浏览器覆盖率已超过 92%，可以在生产环境放心使用，以 `@supports` 作为渐进增强的后备。

## 总结

CSS View Transitions Level 2 填补了多页应用动画的最后一块拼图。不再需要 JavaScript 框架介入，不再需要手动管理动画状态，只需几行 CSS 声明，你的网站就能拥有媲美原生应用的页面过渡体验。对于 2026 年新建的 MPA 项目，这应该是默认启用的标配功能。
