---
title: "CSS 自定义属性（变量）进阶：主题切换与动态样式"
date: 2018-02-27 16:32:20
tags:
  - CSS
readingTime: 2
description: "CSS 自定义属性（也叫 CSS 变量）现在主流浏览器都支持了，IE 除外。它和 Sass 变量不一样，有自己独特的优势，值得认真了解。"
wordCount: 429
---

CSS 自定义属性（也叫 CSS 变量）现在主流浏览器都支持了，IE 除外。它和 Sass 变量不一样，有自己独特的优势，值得认真了解。

## 基础语法

```css
/* 定义变量：以 -- 开头 */
:root {
  --primary-color: #409eff;
  --font-size-base: 14px;
  --spacing-md: 16px;
}

/* 使用变量：var() 函数 */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
}

/* 可以提供默认值 */
.text {
  color: var(--text-color, #333); /* --text-color 未定义时用 #333 */
}
```

## 和 Sass 变量的本质区别

Sass 变量是编译时的，编译后就消失了：

```scss
// Sass 变量
$primary: #409eff;
.btn {
  color: $primary;
}

// 编译后
.btn {
  color: #409eff;
}
// 变量不存在于运行时，无法动态改变
```

CSS 变量存在于运行时：

```css
/* CSS 变量在运行时存在，可以动态修改 */
:root { --primary: #409eff; }
.btn { color: var(--primary); }

/* JavaScript 可以修改 */
document.documentElement.style.setProperty('--primary', '#67c23a')
/* 页面上所有用 var(--primary) 的地方立即更新 */
```

这是 CSS 变量最大的优势：**支持运行时动态修改**。

## 应用场景 1：主题切换

以前实现主题切换，要么预编译多套 CSS，要么用 JS 替换 class。CSS 变量简化了很多：

```css
/* 定义主题 */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --primary: #409eff;
}

[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --primary: #64b5f6;
}

/* 所有组件只用变量，不写具体颜色 */
body {
  background: var(--bg-color);
  color: var(--text-color);
}
```

```javascript
// 切换主题
document.documentElement.setAttribute("data-theme", "dark");
document.documentElement.setAttribute("data-theme", "light");
```

## 应用场景 2：动态间距/尺寸

响应式布局里，间距随屏幕变化：

```css
:root {
  --spacing: 16px;
}

@media (max-width: 768px) {
  :root {
    --spacing: 8px;
  }
}

.card {
  padding: var(--spacing);
  margin-bottom: var(--spacing);
}

.card-header {
  padding: calc(var(--spacing) / 2) var(--spacing);
}
```

## 应用场景 3：组件级变量（局部作用域）

CSS 变量遵循 CSS 继承规则，可以在组件内覆盖：

```css
/* 全局默认 */
:root {
  --button-bg: #409eff;
  --button-radius: 4px;
}

/* 在特定上下文内覆盖 */
.danger-zone {
  --button-bg: #f56c6c;
}

/* 所有在 .danger-zone 内的按钮都会用红色背景 */
.button {
  background: var(--button-bg);
  border-radius: var(--button-radius);
}
```

这种模式特别适合组件库的主题定制：

```css
/* 使用者可以覆盖组件的默认样式变量 */
.my-app {
  --el-color-primary: #722ed1; /* 自定义 Element UI 主题色 */
}
```

## 与 Sass 配合使用

实际项目里可以两者结合：Sass 负责编译时的逻辑（循环、条件、函数），CSS 变量负责运行时动态性。

```scss
// 用 Sass 批量生成 CSS 变量
$colors: (
  "primary": #409eff,
  "success": #67c23a,
  "warning": #e6a23c,
  "danger": #f56c6c,
);

:root {
  @each $name, $value in $colors {
    --color-#{$name}: #{$value};
  }
}
```

## JavaScript 读写 CSS 变量

```javascript
// 读取
const value = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// 设置
document.documentElement.style.setProperty("--primary-color", "#67c23a");

// 删除（恢复继承的值）
document.documentElement.style.removeProperty("--primary-color");

// 在组件内局部设置
element.style.setProperty("--button-size", "32px");
```

## 浏览器支持

截至 2018 年初，主流浏览器都已支持：Chrome 49+、Firefox 31+、Safari 9.1+、Edge 15+。唯独 IE 不支持。

如果需要支持 IE，可以用 `postcss-custom-properties` 在编译时将变量替换为具体值（失去动态能力，但保证兼容性）。

## 小结

- CSS 变量的核心价值是**运行时动态**，这是 Sass 变量做不到的
- 主题切换、响应式设计、组件主题定制是最佳应用场景
- 变量有作用域，在子元素内可以覆盖父元素的变量值
- 配合 JavaScript `setProperty` 实现真正的动态主题