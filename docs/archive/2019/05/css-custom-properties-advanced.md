---
title: "CSS Custom Properties 高级用法"
date: 2019-05-15 11:24:19
tags:
  - CSS
readingTime: 4
description: "CSS Custom Properties（也叫 CSS Variables）已经得到现代浏览器的全面支持。很多人只知道它能定义颜色变量，但它的能力远不止于此。这篇文章介绍 CSS Custom Properties 的高级用法和实战技巧。"
---

CSS Custom Properties（也叫 CSS Variables）已经得到现代浏览器的全面支持。很多人只知道它能定义颜色变量，但它的能力远不止于此。这篇文章介绍 CSS Custom Properties 的高级用法和实战技巧。

## 基础回顾

```css
/* 声明：必须以 -- 开头 */
:root {
  --primary-color: #3498db;
  --primary-dark: #2980b9;
  --font-size-base: 16px;
  --spacing-unit: 8px;
  --border-radius: 4px;
  --transition-speed: 0.3s;
}

/* 使用：通过 var() 函数 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: calc(var(--spacing-unit) * 2) calc(var(--spacing-unit) * 3);
  border-radius: var(--border-radius);
  transition: background-color var(--transition-speed) ease;
}

.button:hover {
  background-color: var(--primary-dark);
}
```

## fallback 值

`var()` 函数支持第二个参数作为默认值。

```css
/* 如果 --primary-color 未定义，使用 #3498db */
.element {
  color: var(--primary-color, #3498db);
}

/* fallback 可以嵌套 */
.element {
  /* 先尝试 --primary-color，没有就用 --brand-color，再没有就用红色 */
  color: var(--primary-color, var(--brand-color, red));
}

/* 实战：组件库的默认值设计 */
.card {
  --card-bg: var(--card-background, #ffffff);
  --card-shadow: var(--shadow, 0 2px 8px rgba(0, 0, 0, 0.1));
  --card-radius: var(--border-radius, 8px);

  background: var(--card-bg);
  box-shadow: var(--card-shadow);
  border-radius: var(--card-radius);
}

/* 使用时可以覆盖，也可以不覆盖用默认值 */
.promo-card {
  --card-background: #fffbe6;
  --shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}
```

## calc() 与变量组合

这是 CSS Custom Properties 最强大的特性之一。

```css
:root {
  --base-size: 16px;
  --scale-ratio: 1.25;
  --spacing: 8px;
  --column-count: 12;
  --container-max: 1200px;
}

/* 排版系统：用一个 base 和 ratio 生成完整的字号阶梯 */
.heading-1 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio)); }
.heading-2 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio) * var(--scale-ratio)); }
.heading-3 { font-size: calc(var(--base-size) * var(--scale-ratio) * var(--scale-ratio)); }
.body-text { font-size: var(--base-size); }
.small-text { font-size: calc(var(--base-size) / var(--scale-ratio)); }

/* 间距系统 */
.container {
  padding: calc(var(--spacing) * 3);
  margin-bottom: calc(var(--spacing) * 2);
  max-width: var(--container-max);
}

/* 栅格系统 */
.column {
  /* 每列宽度 = (容器最大宽度 - (列数+1) * 间距) / 列数 */
  width: calc(
    (var(--container-max) - (var(--column-count) + 1) * var(--spacing)) /
    var(--column-count)
  );
  margin-right: var(--spacing);
}

.column:last-child {
  margin-right: 0;
}

/* 混合单位计算 */
.hero {
  /* 100vh 减去 80px 的头部高度 */
  min-height: calc(100vh - 80px);
  /* 用变量替代固定值 */
  --header-height: 80px;
  min-height: calc(100vh - var(--header-height));
}

/* 百分比 + 像素混合 */
.sidebar {
  --sidebar-width: 250px;
  --content-gap: 24px;
  width: var(--sidebar-width);
}

.content {
  /* 计算剩余宽度 */
  width: calc(100% - var(--sidebar-width) - var(--content-gap));
  margin-left: var(--content-gap);
}
```

## 主题切换

最实用的场景：暗色主题。

```css
/* 浅色主题（默认） */
:root {
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text: #333333;
  --color-text-secondary: #666666;
  --color-border: #e0e0e0;
  --color-primary: #3498db;
  --color-success: #27ae60;
  --color-warning: #f39c12;
  --color-danger: #e74c3c;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* 暗色主题 */
[data-theme="dark"] {
  --color-bg: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-text: #e0e0e0;
  --color-text-secondary: #a0a0a0;
  --color-border: #333355;
  --color-primary: #5dade2;
  --color-success: #58d68d;
  --color-warning: #f5b041;
  --color-danger: #ec7063;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.25);
}

/* 组件只需使用变量，不需要关心当前主题 */
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  padding: 24px;
  border-radius: 8px;
}

.card-title {
  color: var(--color-text);
}

.card-description {
  color: var(--color-text-secondary);
}

.alert-success {
  background-color: var(--color-success);
  color: #fff;
  padding: 12px 16px;
  border-radius: 4px;
}

.alert-danger {
  background-color: var(--color-danger);
  color: #fff;
  padding: 12px 16px;
  border-radius: 4px;
}
```

配合 JavaScript 切换：

```javascript
// 切换主题
function toggleTheme() {
  const html = document.documentElement
  const current = html.getAttribute('data-theme')
  const next = current === 'dark' ? 'light' : 'dark'
  html.setAttribute('data-theme', next)
  localStorage.setItem('theme', next)
}

// 初始化：读取本地存储或系统偏好
function initTheme() {
  const saved = localStorage.getItem('theme')
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}

initTheme()
```

## 通过 JavaScript 读写变量

CSS Custom Properties 可以在 JavaScript 中读写，这打通了 CSS 和 JS 的桥梁。

```javascript
// 读取变量值
const root = getComputedStyle(document.documentElement)
const primaryColor = root.getPropertyValue('--primary-color').trim()
console.log(primaryColor) // '#3498db'

// 设置变量值
document.documentElement.style.setProperty('--primary-color', '#e74c3c')

// 删除变量
document.documentElement.style.removeProperty('--primary-color')

// 作用于特定元素
const card = document.querySelector('.card')
card.style.setProperty('--card-bg', '#fffbe6')

// 实战：动态修改间距系统
function updateSpacing(baseSpacing) {
  document.documentElement.style.setProperty('--spacing-unit', `${baseSpacing}px`)
}

// 实战：运行时调整字号（无障碍功能）
function increaseFontSize() {
  const root = getComputedStyle(document.documentElement)
  const current = parseFloat(root.getPropertyValue('--base-font-size'))
  document.documentElement.style.setProperty('--base-font-size', `${current + 2}px`)
}

// 实战：从 CSS 读值到 JS 使用
function getThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    bg: styles.getPropertyValue('--color-bg').trim(),
    text: styles.getPropertyValue('--color-text').trim(),
    primary: styles.getPropertyValue('--color-primary').trim()
  }
}
```

## 作用域与继承

CSS Custom Properties 遵循 CSS 的级联和继承规则，这是它的独特优势。

```css
/* 全局变量 */
:root {
  --color: blue;
  --font-size: 16px;
}

/* 局部覆盖 */
.sidebar {
  --color: green;
  --font-size: 14px;
}

/* .sidebar 内部的所有元素继承绿色 */
.sidebar p {
  color: var(--color); /* green */
  font-size: var(--font-size); /* 14px */
}

/* 更深层的覆盖 */
.sidebar .special {
  --color: red;
  color: var(--color); /* red */
}

/* 组件级别的变量：BEM + Custom Properties */
/* BEM 命名 + Custom Properties 是很好的组合 */
.button {
  --btn-padding: 10px 20px;
  --btn-bg: var(--primary-color);
  --btn-color: #ffffff;
  --btn-radius: 4px;

  padding: var(--btn-padding);
  background: var(--btn-bg);
  color: var(--btn-color);
  border-radius: var(--btn-radius);
}

.button--large {
  --btn-padding: 14px 28px;
  --btn-radius: 6px;
}

.button--danger {
  --btn-bg: #e74c3c;
}

.button--outline {
  --btn-bg: transparent;
  --btn-color: var(--primary-color);
  border: 2px solid var(--btn-bg);
}
```

## 响应式设计

结合媒体查询使用变量。

```css
:root {
  --container-padding: 16px;
  --grid-columns: 4;
  --font-size-base: 14px;
  --sidebar-width: 240px;
}

/* 平板 */
@media (min-width: 768px) {
  :root {
    --container-padding: 24px;
    --grid-columns: 8;
    --font-size-base: 15px;
  }
}

/* 桌面 */
@media (min-width: 1024px) {
  :root {
    --container-padding: 32px;
    --grid-columns: 12;
    --font-size-base: 16px;
    --sidebar-width: 280px;
  }
}

/* 大屏 */
@media (min-width: 1440px) {
  :root {
    --container-padding: 48px;
    --sidebar-width: 320px;
  }
}

/* 使用变量的组件会自动适应断点 */
.page {
  padding: var(--container-padding);
  font-size: var(--font-size-base);
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--grid-columns), 1fr);
  gap: calc(var(--container-padding) / 2);
}

.sidebar {
  width: var(--sidebar-width);
}
```

## 实用技巧

### 透明度变体

```css
:root {
  --primary-color: 52, 152, 219; /* RGB 值，不带 rgb() */
}

.element {
  background-color: rgb(var(--primary-color));
  /* 通过 rgba 实现透明度变体，不需要额外定义变量 */
  border-color: rgba(var(--primary-color), 0.3);
  box-shadow: 0 2px 8px rgba(var(--primary-color), 0.2);
}

.hover-state {
  background-color: rgba(var(--primary-color), 0.1);
}
```

### 动画控制

```css
:root {
  /* 用变量控制动画 */
  --animation-duration: 0.3s;
  --animation-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-in {
  animation: fadeIn var(--animation-duration) var(--animation-easing);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 全局调整动画速度（比如用户偏好减少动画） */
@media (prefers-reduced-motion: reduce) {
  :root {
    --animation-duration: 0.01s;
  }
}
```

### CSS 自定义属性与 Grid

```css
:root {
  --grid-gap: 16px;
  --card-min-width: 280px;
}

.auto-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--card-min-width), 1fr)
  );
  gap: var(--grid-gap);
}

/* 不同区域覆盖最小宽度 */
.featured-grid {
  --card-min-width: 360px;
}
```

### 条件样式（利用无效值）

```css
/* 当 --icon-url 有值时显示图标，没有时隐藏 */
.icon {
  background-image: var(--icon-url, none);
  background-size: contain;
  width: var(--icon-size, 24px);
  height: var(--icon-size, 24px);
}

/* 使用时 */
.search-input {
  --icon-url: url('search.svg');
  --icon-size: 20px;
}
```

## 小结

- CSS Custom Properties 遵循级联和继承规则，天然适合主题系统和组件化开发
- `calc()` 与变量组合能实现响应式的排版系统和栅格布局
- 通过 JavaScript 读写变量，打通了 CSS 和 JS 的桥梁
- 用 fallback 值和作用域特性实现组件库的默认值设计
- 拆分 RGB 值到变量中，用 `rgba()` 实现透明度变体，减少变量数量
- 在 `:root` 上结合媒体查询改变变量值，让所有引用该变量的样式自动适应断点
