---
title: "CSS 容器查询 2026 实战：响应式组件设计新范式"
date: 2026-06-05 11:34:38
tags:
  - CSS
readingTime: 4
description: "容器查询已经成为 2026 年响应式设计的主流方案。本文从基础语法到复杂布局，系统讲解容器查询在实际项目中的应用模式和最佳实践。"
wordCount: 686
---

响应式设计从媒体查询走向容器查询，是 CSS 发展历程中的重要转折点。2026 年，容器查询的浏览器支持率已经超过 95%，在实际项目中的应用也越来越成熟。理解容器查询的核心价值和应用模式，是现代前端开发者的必备能力。

## 从媒体查询到容器查询

传统媒体查询的问题在于它只能感知视口尺寸，无法感知组件自身可用空间：

```css
/* 媒体查询：基于视口 */
@media (min-width: 768px) {
  .card { display: grid; grid-template-columns: 200px 1fr; }
}

/* 问题：当侧边栏收起时，主内容区变窄，但视口没变 */
/* 结果：卡片仍然按两列布局，内容被挤压 */
```

容器查询解决了这个问题——它让组件根据自身容器的尺寸来调整布局：

```css
/* 容器查询：基于父容器 */
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}

@container (max-width: 399px) {
  .card {
    display: flex;
    flex-direction: column;
  }
}
```

## 基础语法详解

### 容器类型

`container-type` 有三个值：

```css
/* inline-size：只监听水平尺寸（最常用） */
.sidebar { container-type: inline-size; }

/* size：同时监听水平和垂直尺寸 */
.chart-container { container-type: size; }

/* normal：普通元素，不作为容器 */
.normal-element { container-type: normal; }
```

大多数场景下使用 `inline-size` 就足够了，因为响应式设计主要关注水平方向的变化。

### 容器查询语法

容器查询的语法与媒体查询类似，但支持更多特性：

```css
/* 基础尺寸查询 */
@container (min-width: 500px) { ... }
@container (max-width: 499px) { ... }

/* 范围查询 */
@container (400px <= width <= 800px) { ... }

/* 查询容器名称 */
.sidebar { container-type: inline-size; container-name: sidebar; }
@container sidebar (min-width: 300px) { ... }

/* 样式查询（7.2 新特性） */
@container style(--theme: dark) { ... }
```

### 命名容器

当页面有多个容器时，命名容器可以避免查询冲突：

```css
/* 定义命名容器 */
.page-header { container-type: inline-size; container-name: header; }
.main-content { container-type: inline-size; container-name: content; }

/* 针对特定容器查询 */
@container header (min-width: 600px) {
  .nav-items { display: flex; gap: 1rem; }
}

@container content (min-width: 800px) {
  .article-body { columns: 2; }
}
```

## 实际应用模式

### 卡片组件响应式

一个典型的卡片组件需要根据容器宽度调整布局：

```css
.card-wrapper {
  container-type: inline-size;
}

.card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

/* 小容器：垂直布局 */
@container (max-width: 399px) {
  .card {
    grid-template-columns: 1fr;
  }
  .card-image { aspect-ratio: 16/9; }
}

/* 中等容器：水平布局，图片在左 */
@container (400px <= width <= 699px) {
  .card {
    grid-template-columns: 150px 1fr;
  }
}

/* 大容器：水平布局，图片更大 */
@container (min-width: 700px) {
  .card {
    grid-template-columns: 250px 1fr;
  }
  .card-title { font-size: 1.5rem; }
}
```

### 导航栏响应式

导航栏是容器查询最经典的应用场景：

```css
.navbar {
  container-type: inline-size;
  container-name: nav;
}

.nav-items {
  display: flex;
  gap: 0.5rem;
  list-style: none;
}

/* 宽容器：完整导航 */
@container nav (min-width: 768px) {
  .nav-items {
    justify-content: center;
  }
  .nav-toggle { display: none; }
}

/* 窄容器：汉堡菜单 */
@container nav (max-width: 767px) {
  .nav-items {
    position: fixed;
    top: 0;
    left: -100%;
    width: 80%;
    flex-direction: column;
    background: var(--bg-primary);
    transition: left 0.3s ease;
  }
  .nav-items.open { left: 0; }
  .nav-toggle { display: block; }
}
```

### 侧边栏布局

侧边栏的收起/展开状态可以用容器查询优雅处理：

```css
.layout {
  display: grid;
  grid-template-columns: auto 1fr;
  container-type: inline-size;
}

.sidebar {
  width: 250px;
  transition: width 0.3s ease;
}

.sidebar.collapsed { width: 60px; }

/* 主内容区根据侧边栏状态调整 */
@container (max-width: 800px) {
  .sidebar {
    position: fixed;
    z-index: 100;
    transform: translateX(-100%);
  }
  .sidebar.open { transform: translateX(0); }
  .main-content { grid-column: 1 / -1; }
}
```

## 容器查询与 CSS 变量

容器查询可以与 CSS 变量结合，实现更灵活的响应式设计：

```css
.card-wrapper {
  container-type: inline-size;
  
  /* 根据容器尺寸设置 CSS 变量 */
  --card-padding: 1rem;
  --card-font-size: 0.875rem;
}

@container (min-width: 500px) {
  .card-wrapper {
    --card-padding: 1.5rem;
    --card-font-size: 1rem;
  }
}

@container (min-width: 800px) {
  .card-wrapper {
    --card-padding: 2rem;
    --card-font-size: 1.125rem;
  }
}

.card {
  padding: var(--card-padding);
  font-size: var(--card-font-size);
}
```

## 浏览器兼容性处理

虽然容器查询的支持率很高，但仍需考虑旧浏览器的降级方案：

```css
/* 基础样式（不使用容器查询） */
.card {
  display: flex;
  flex-direction: column;
}

/* 现代浏览器：使用容器查询增强 */
@supports (container-type: inline-size) {
  .card-wrapper {
    container-type: inline-size;
  }
  
  @container (min-width: 500px) {
    .card {
      flex-direction: row;
    }
  }
}
```

## 性能优化

容器查询的性能通常不是问题，但在复杂布局中仍需注意：

1. **避免过度嵌套**：不要在已经很小的容器中再定义容器查询
2. **合理选择容器类型**：大多数场景下 `inline-size` 就足够了
3. **使用 `contain` 属性**：在容器元素上添加 `contain: layout style` 可以优化渲染性能

```css
/* 优化的容器定义 */
.card-wrapper {
  container-type: inline-size;
  contain: layout style;
}
```

## 实战：响应式数据表格

数据表格是容器查询的典型应用场景：

```css
.table-wrapper {
  container-type: inline-size;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

/* 小容器：卡片式布局 */
@container (max-width: 600px) {
  .data-table thead { display: none; }
  
  .data-table tr {
    display: block;
    margin-bottom: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }
  
  .data-table td {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 1rem;
  }
  
  .data-table td::before {
    content: attr(data-label);
    font-weight: 600;
    color: var(--text-secondary);
  }
}

/* 大容器：传统表格布局 */
@container (min-width: 601px) {
  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }
}
```

## 小结

容器查询是 CSS 响应式设计的未来方向。它让组件真正拥有了"自我感知"的能力，能够根据自身可用空间而不是视口尺寸来调整布局。在实际项目中，容器查询特别适合处理侧边栏布局、卡片组件、导航栏和数据表格等场景。掌握容器查询的关键是理解"组件驱动"的响应式思维——不再考虑"视口有多宽"，而是考虑"这个组件有多少空间"。
