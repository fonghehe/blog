---
title: "CSS 自定义属性（变量）实战"
date: 2019-06-21 10:26:38
tags:
  - CSS
readingTime: 1
description: "CSS 自定义属性（又叫 CSS 变量）已经被主流浏览器支持了，比 Sass 变量更灵活，可以运行时修改。"
wordCount: 171
---

CSS 自定义属性（又叫 CSS 变量）已经被主流浏览器支持了，比 Sass 变量更灵活，可以运行时修改。

## 基本用法

```css
/* 定义：-- 前缀，通常放在 :root */
:root {
  --color-primary: #409eff;
  --color-success: #67c23a;
  --color-danger: #f56c6c;

  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;

  --border-radius: 4px;
  --font-size-base: 14px;
}

/* 使用：var() 函数 */
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius);
}

/* 带默认值 */
.card {
  color: var(--card-color, #333); /* 如果 --card-color 未定义，用 #333 */
}
```

## 主题切换（核心场景）

```css
/* 默认主题（亮色） */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --border-color: #e8e8e8;
}

/* 暗色主题 */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e8e8e8;
  --border-color: #333333;
}

/* 组件使用变量，主题切换时自动更新 */
body {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.card {
  border: 1px solid var(--border-color);
  background: var(--bg-color);
}
```

```javascript
// 切换主题
function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "light" : "dark",
  );
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

// 初始化（读取用户偏好）
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
document.documentElement.setAttribute("data-theme", savedTheme);
```

## 用 JS 动态修改

```javascript
// 读取变量值
const primaryColor = getComputedStyle(document.documentElement)
  .getPropertyValue("--color-primary")
  .trim();

// 修改变量（立即生效，所有用到这个变量的地方都更新）
document.documentElement.style.setProperty("--color-primary", "#ff6b6b");

// 修改局部变量
const card = document.querySelector(".card");
card.style.setProperty("--card-bg", "#f5f5f5");
```

## 和 Sass 变量的区别

```scss
// Sass 变量：编译时处理，最终输出固定 CSS 值
$primary: #409eff;
.button {
  background: $primary;
} // 编译后 → background: #409eff;

// 如果要"主题切换"，需要编译两套 CSS
```

```css
/* CSS 变量：运行时处理，可以动态修改 */
:root {
  --primary: #409eff;
}
.button {
  background: var(--primary);
}
/* 修改 --primary，所有 .button 立即更新，不需要重新编译 */
```

两者可以配合使用：Sass 处理计算逻辑，输出 CSS 变量。

## 组件级变量

```css
/* 组件可以有自己的变量，外部可以覆盖 */
.card {
  --card-padding: 16px;
  --card-border-radius: 8px;

  padding: var(--card-padding);
  border-radius: var(--card-border-radius);
}

/* 外部定制 */
.dashboard .card {
  --card-padding: 24px; /* 这个 .card 有更大的 padding */
}
```

## 小结

- CSS 变量运行时生效，可以用 JS 动态修改，比 Sass 变量更灵活
- `:root` 定义全局变量，组件内定义局部变量
- `data-theme` 属性 + CSS 变量 = 零运行时成本的主题切换
- 用 `prefers-color-scheme` 媒体查询尊重用户系统主题偏好
