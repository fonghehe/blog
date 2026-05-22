---
title: "State of CSS 2023: Container Queries, Nesting, and Color Functions Go Mainstream"
date: 2023-09-22 17:22:14
tags:
  - CSS
readingTime: 2
description: "The State of CSS 2023 survey results were published in 2023, with data from 9,000+ developers worldwide. This year's main theme is \"long-awaited features are fi"
wordCount: 233
---

The State of CSS 2023 survey results were published in 2023, with data from 9,000+ developers worldwide. This year's main theme is "long-awaited features are finally usable": Container Queries, native CSS nesting, `:has()` selector, `color-mix()`, and others have all surpassed 85% browser support, entering the practically usable range.

## Container Queries: True Component-Level Responsive Design

Finally, no need to rely on viewport width for responsive design. `@container` lets components adjust their styles based on their own container size:

```css
/* 定义容器 */
.card-container {
  container-type: inline-size;
  container-name: card;
}

/* 容器查询 */
@container card (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container card (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

```html
<!-- 同一组件在不同容器中自动适应 -->
<aside class="narrow-sidebar">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 竖向布局 -->
  </div>
</aside>

<main class="wide-content">
  <div class="card-container">
    <div class="card">...</div>
    <!-- 横向网格布局 -->
  </div>
</main>
```

**Container Query Units (cqw/cqh)**:

```css
.responsive-text {
  font-size: clamp(14px, 4cqw, 24px); /* 字体随容器宽度变化 */
}
```

## Native CSS Nesting: The Key Reason to Drop Preprocessors

Baseline 2023, supported by Chrome 112+, Safari 16.5+, Firefox 117+:

```css
/* 原生 CSS 嵌套（2023 年稳定） */
.button {
  background: #0066ff;
  color: white;
  padding: 8px 16px;

  &:hover {
    background: #0052cc;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 嵌套媒体查询 */
  @media (max-width: 768px) {
    padding: 6px 12px;
    font-size: 14px;
  }

  /* 嵌套容器查询 */
  @container (min-width: 400px) {
    padding: 12px 24px;
  }
}
```

## :has() Selector: The Parent Selector Finally Realized

```css
/* 含有 img 的 card 显示特殊样式 */
.card:has(img) {
  padding: 0;
  overflow: hidden;
}

/* 含有 required 输入框的 form-group 显示必填标记 */
.form-group:has(input:required) .label::after {
  content: " *";
  color: red;
}

/* 父选择器用途：选中包含 :checked input 的 li */
li:has(input:checked) {
  background: #e8f5e9;
  font-weight: bold;
}

/* 当表格有超过 5 列时，调整单元格内边距 */
table:has(th:nth-child(5)) td {
  padding: 4px 8px; /* 列多时缩小内边距 */
}
```

## color-mix(): Native CSS Color Mixing

```css
:root {
  --primary: #0066ff;
  --primary-hover: color-mix(in srgb, var(--primary) 85%, black); /* 深15% */
  --primary-light: color-mix(in srgb, var(--primary) 20%, white); /* 浅80% */
  --primary-transparent: color-mix(in srgb, var(--primary) 60%, transparent);
}

.button {
  background: var(--primary);

  &:hover {
    background: var(--primary-hover); /* 自动计算悬停颜色 */
  }
}

.badge {
  background: var(--primary-light);
  border: 1px solid var(--primary);
}
```

## CSS Relative Color Syntax (More Powerful Color Calculations)

```css
:root {
  --accent: hsl(200deg 80% 50%);
}

.variant-dark {
  /* 从 --accent 派生，只改亮度 */
  background: hsl(from var(--accent) h s calc(l - 15%));
}

.variant-muted {
  /* 降低饱和度 */
  background: hsl(from var(--accent) h calc(s - 40%) l);
}
```

## CSS Cascade Layers (@layer): Solving Specificity Wars

```css
/* 按优先级从低到高声明层级 */
@layer reset, base, components, utilities;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer base {
  a {
    color: inherit;
  }
  button {
    cursor: pointer;
  }
}

@layer components {
  .card {
    /* 组件样式 */
  }
}

@layer utilities {
  .text-center {
    text-align: center !important;
  }
}

/* 不在任何层的样式总是胜过层内样式 */
.critical {
  color: red;
} /* 优先级最高，无需 !important */
```

## 2023 State of CSS Survey Highlights

- **Container Queries awareness**: 91%, usage jumped from 19% in 2022 to 42%
- **`:has()`**: 72% awareness, 38% usage (remarkably high for its first year of full support)
- **Native nesting**: 87% awareness, 35% usage
- **Most desired new feature**: `if()` function (CSS conditional values) ranks first

## Summary

2023 is CSS's "harvest year" — features that have been waiting for years are finally universally available. Container Queries make components truly self-contained, `:has()` realizes the long-missing parent selector capability, and native nesting dramatically improves CSS readability. For projects still heavily using SCSS, 2023 is a good time to evaluate "whether you still need a preprocessor".