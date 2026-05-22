---
title: "State of CSS 2023：容器查询、嵌套与色彩函数全面落地"
date: 2023-09-22 17:22:14
tags:
  - CSS
readingTime: 2
description: "State of CSS 2023 调查结果于 2023 年发布，数据来自全球 9,000+ 开发者。今年的主旋律是\"等了很久的特性终于可以用了\"：Container Queries、原生 CSS 嵌套、`:has()` 选择器、`color-mix()` 等在各大浏览器的支持度都突破了 85%，进入实际可用区间。"
wordCount: 393
---

State of CSS 2023 调查结果于 2023 年发布，数据来自全球 9,000+ 开发者。今年的主旋律是"等了很久的特性终于可以用了"：Container Queries、原生 CSS 嵌套、`:has()` 选择器、`color-mix()` 等在各大浏览器的支持度都突破了 85%，进入实际可用区间。

## 容器查询（Container Queries）：真正的组件级响应式

终于不用依赖视口宽度做响应式了。`@container` 让组件可以根据自身容器的大小调整样式：

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

**容器查询单位（cqw/cqh）**：

```css
.responsive-text {
  font-size: clamp(14px, 4cqw, 24px); /* 字体随容器宽度变化 */
}
```

## 原生 CSS 嵌套：告别预处理器的核心理由

Baseline 2023，Chrome 112+、Safari 16.5+、Firefox 117+ 全部支持：

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

## :has() 选择器：实现了"父选择器"

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

## color-mix()：CSS 原生颜色混合

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

## CSS 相对颜色语法（更强大的颜色计算）

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

## CSS 级联层（@layer）：解决特异性大战

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

## 2023 年 State of CSS 调查亮点数据

- **容器查询知晓率**：91%，使用率从 2022 年的 19% 跃升至 42%
- **`:has()`**：知晓率 72%，使用率 38%（第一年全面支持就有这么高使用率）
- **原生嵌套**：知晓率 87%，使用率 35%
- **最想要的新特性**：`if()` 函数（CSS 条件值）排名第一

## 总结

2023 年是 CSS 的"收割年"——等待了数年的特性终于全面可用。Container Queries 让组件真正自包含，`:has()` 实现了长期缺失的父选择器能力，原生嵌套让 CSS 可读性大幅提升。对于仍在大量使用 SCSS 的项目，2023 年是评估"是否还需要预处理器"的好时机。