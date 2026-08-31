---
title: "CSS Container Queries: Browser Support Is Coming"
date: 2021-08-23 09:48:53
tags:
  - CSS

readingTime: 2
description: "If you follow the CSS spec, you may have noticed that Container Queries have entered the experimental stage in Chrome Canary. This feature has been awaited for years, and it's finally arriving."
wordCount: 224
---

If you follow the CSS spec, you may have noticed that Container Queries have entered the experimental stage in Chrome Canary. This feature has been awaited for years, and it's finally arriving.

## What Are Container Queries

Media Queries respond to the **viewport width**, while Container Queries respond to the **parent container's width**.

This is exactly the capability that component-based development has been missing.

```css
/* Media Queries：根据浏览器窗口宽度 */
@media (min-width: 768px) {
  .card { flex-direction: row; }
}

/* Container Queries：根据父容器宽度 */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## Why This Feature Matters

The current pain point: the same component placed in a sidebar (narrow) versus the main content area (wide) should look different. Yet Media Queries only look at the viewport, not the container.

```html
<!-- 同一个 Card 组件 -->
<div class="sidebar">
  <Card /> <!-- 侧边栏窄，应该显示紧凑布局 -->
</div>

<main>
  <Card /> <!-- 主内容区宽，应该显示完整布局 -->
</main>

<!-- 两个 Card 在同一个视口下，Media Queries 无法区分 -->
```

## Syntax Deep Dive

```css
/* 1. 定义容器 */
.card-container {
  container-type: inline-size;  /* 只监控 inline 方向（水平）的尺寸 */
  container-name: card;          /* 可选：给容器命名 */
}

/* 简写 */
.card-container {
  container: card / inline-size;
}

/* 2. 使用 @container 查询 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .card__image {
    aspect-ratio: 1;
  }
}

@container card (min-width: 600px) {
  .card {
    grid-template-columns: 300px 1fr;
    gap: 2rem;
  }
}
```

## Real-World Case: Responsive Card

```css
.card-wrapper {
  container: card / inline-size;
}

/* 窄容器：垂直堆叠 */
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card__title {
  font-size: 1rem;
}

/* 中等容器：水平排列 */
@container card (min-width: 350px) {
  .card {
    flex-direction: row;
    align-items: center;
  }

  .card__image {
    width: 120px;
    flex-shrink: 0;
  }

  .card__title {
    font-size: 1.125rem;
  }
}

/* 宽容器：更大的布局 */
@container card (min-width: 500px) {
  .card {
    gap: 1.5rem;
  }

  .card__image {
    width: 200px;
  }

  .card__title {
    font-size: 1.25rem;
  }
}
```

## Comparison with Existing Solutions

```javascript
// 现在的常见做法：用 ResizeObserver 监控容器宽度
// 不优雅，而且有性能开销

const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const width = entry.contentRect.width
    entry.target.classList.toggle('compact', width < 400)
    entry.target.classList.toggle('normal', width >= 400 && width < 600)
    entry.target.classList.toggle('wide', width >= 600)
  }
})

document.querySelectorAll('.card-wrapper').forEach((el) => {
  observer.observe(el)
})

// Container Queries 一行 CSS 搞定，浏览器原生优化
```

## Working with Tailwind CSS

Tailwind 3.0 already offers experimental support for `@container`:

```html
<!-- 需要在容器上加 container 类 -->
<div class="@container">
  <div class="flex @md:flex-row @lg:gap-8">
    <img class="w-full @md:w-32 @lg:w-48" />
    <div class="@md:ml-4">
      <h3 class="text-sm @md:text-lg @lg:text-xl">标题</h3>
    </div>
  </div>
</div>
```

## Browser Support Status

As of August 2021:

- Chrome Canary: experimental support (requires enabling a flag)
- Chrome 105+: expected to ship by default
- Firefox / Safari: no timeline yet

For now you can use a PostCSS plugin as a fallback:

```bash
npm install -D @csstools/postcss-container-queries
```

## Summary

- Container Queries let components respond to their parent container's width, resolving the fundamental limitation of Media Queries
- Syntax: `container-type` defines the container and `@container` queries it
- An essential tool for component-based development — Grid plus Container Queries enable genuinely responsive components
- Browser support is still in its early days, but the trend is clear, so it's worth getting familiar with it now