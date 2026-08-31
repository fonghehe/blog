---
title: "CSS Architecture Evolution: From BEM to Utility-First"
date: 2021-09-27 14:31:11
tags:
  - CSS

readingTime: 2
description: "This year I drove a CSS architecture upgrade within my team — migrating step by step from BEM naming to a utility-first approach. There were arguments and compromises, and we eventually found a balance."
wordCount: 286
---

This year I led a CSS architecture upgrade within the team—gradually migrating from the BEM naming convention to a Utility-First approach. There were debates and compromises along the way, but we eventually found a balance.

## Pain Points of BEM

We used BEM (Block-Element-Modifier) for four years. It solved our naming-collision problem, but as projects grew, new issues began to surface:

```css
/* BEM 的典型代码 */
.card { }
.card__header { }
.card__header__title { }
.card__header__title--highlighted { }
.card__body { }
.card__body__content { }
.card__body__content--loading { }

/* 问题一：嵌套层级深时命名爆炸 */
.data-table__row__cell__link__icon--active { }

/* 问题二：每个组件都要写一大堆 CSS */
/* card.css - 200+ 行，其中 60% 是布局和间距 */
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
}
/* 这些 flex、padding、margin 在无数组件中重复 */
```

The core problems are: bloated CSS files, duplicated layout styles, and a high mental overhead for naming.

## Advantages of Utility-First

```html
<!-- 以前：HTML + 对应的 BEM CSS -->
<div class="card">
  <div class="card__header">
    <h3 class="card__header__title">标题</h3>
  </div>
</div>

<!-- Utility-First：样式直接在 HTML 中 -->
<div class="rounded-lg bg-white shadow-md">
  <div class="flex items-center justify-between p-4 mb-3">
    <h3 class="text-lg font-semibold text-gray-900">标题</h3>
  </div>
</div>
```

The advantages are obvious: no more jumping between HTML and CSS, no need to think up class names, and styles are visible at a glance. But the team's initial resistance was strong—"The HTML looks ugly" and "How is this different from inline styles?"

## Our Compromise Solution

Rather than going all-in on Utility-First, we took a layered approach:

```html
<!-- 1. 布局用 utility classes -->
<div class="grid grid-cols-3 gap-4 p-6">
  <!-- 2. 组件语义部分用 BEM -->
  <article class="card">
    <div class="card__header">
      <!-- 3. 细节调整用 utility classes -->
      <h3 class="card__title text-lg mb-1">标题</h3>
      <span class="card__badge bg-red-500 text-white px-2 py-0.5 rounded">
        NEW
      </span>
    </div>
    <div class="card__body text-gray-600">
      内容
    </div>
  </article>
</div>
```

The principles are:
- **Layout and spacing**: use utility classes, no custom CSS
- **Component structural styles**: use BEM to keep semantics
- **Color and font tweaks**: use utility classes

## Unifying Design Tokens with CSS Variables

Regardless of the CSS methodology you use, Design Tokens should be managed centrally:

```css
:root {
  /* 间距系统 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* 颜色系统 */
  --color-primary: #1890ff;
  --color-text: #333;
  --color-text-secondary: #666;

  /* 字体 */
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* 组件中使用 */
.card {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  color: var(--color-text);
}
```

## Toolchain Configuration

We use Windi CSS (which is API-compatible with Tailwind) as our utility tool, together with Vite:

```javascript
// vite.config.ts
import WindiCSS from 'vite-plugin-windicss'

export default {
  plugins: [
    WindiCSS({
      scan: {
        dirs: ['src'],
        fileExtensions: ['vue', 'ts', 'jsx']
      }
    })
  ]
}
```

Windi CSS's on-demand generation keeps the final CSS bundle small, and in JIT mode every utility is compiled on demand.

## Summary

- BEM isn't obsolete; it's just too redundant at the layout and spacing level.
- Utility-First isn't suitable as an all-or-nothing switch; combining it with BEM is the better approach.
- Manage Design Tokens with CSS variables—something you need regardless of methodology.
- Windi CSS / Tailwind JIT makes the runtime overhead of a Utility-First approach virtually zero.
- Team adoption needs to be gradual—start with layout styles first.