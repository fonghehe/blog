---
title: "CSS 变量（自定义属性）实战"
date: 2018-11-15 16:38:45
tags:
  - CSS
---

CSS 变量（Custom Properties）是原生 CSS 特性，和 Sass 变量最大的区别是：**CSS 变量在运行时有效**，可以用 JavaScript 动态修改，还能响应媒体查询。

## 基本语法

```css
/* 定义变量：以 -- 开头，通常定义在 :root 上 */
:root {
  --primary-color: #1890ff;
  --font-size-base: 14px;
  --spacing-md: 16px;
  --border-radius: 4px;
}

/* 使用变量：var() */
.button {
  background-color: var(--primary-color);
  font-size: var(--font-size-base);
  padding: var(--spacing-md);
  border-radius: var(--border-radius);
}

/* var() 的第二个参数是默认值 */
.card {
  color: var(--text-color, #333); /* 如果 --text-color 未定义，用 #333 */
}
```

## 和 Sass 变量的区别

```scss
// Sass 变量：编译时替换，运行时没有"变量"
$primary: #1890ff;
.button {
  color: $primary;
}
// 编译后：.button { color: #1890ff; }
// 无法在运行时改变

// CSS 变量：运行时存在，可以修改
:root {
  --primary: #1890ff;
}
.button {
  color: var(--primary);
}
// 运行时可以修改 --primary，所有用到它的地方立即更新！
```

## 主题切换

```css
/* 亮色主题（默认） */
:root {
  --bg-color: #ffffff;
  --text-color: #333333;
  --border-color: #e8e8e8;
}

/* 暗色主题 */
[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #e8e8e8;
  --border-color: #404040;
}

.card {
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}
```

```javascript
// 切换主题
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  document.documentElement.dataset.theme = current === "dark" ? "" : "dark";
}

// 也可以直接设置某个变量
document.documentElement.style.setProperty("--primary-color", "#52c41a");
```

## 组件级变量

CSS 变量有级联特性，可以在组件范围内覆盖：

```css
/* 全局默认 */
:root {
  --card-padding: 16px;
  --card-radius: 4px;
}

/* 某个特殊容器里的卡片，padding 更大 */
.hero-section {
  --card-padding: 32px;
  --card-radius: 8px;
}

.card {
  padding: var(--card-padding);
  border-radius: var(--card-radius);
}
```

## 响应式

```css
:root {
  --font-size-base: 14px;
  --spacing-base: 16px;
}

/* 移动端用更小的字号和间距 */
@media (max-width: 768px) {
  :root {
    --font-size-base: 12px;
    --spacing-base: 12px;
  }
}
```

## 配合 JavaScript

```javascript
// 读取变量值
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary-color")
  .trim();

// 动态修改
document.documentElement.style.setProperty("--primary-color", "#52c41a");

// 组件里修改局部变量
this.$el.style.setProperty("--component-width", "300px");
```

## 浏览器兼容

CSS 变量在 IE 上不支持。如果需要兼容 IE，要用 Sass 变量做 fallback：

```css
.button {
  background: #1890ff; /* IE fallback */
  background: var(--primary-color); /* 支持 CSS 变量的浏览器 */
}
```

## 小结

- CSS 变量以 `--` 开头，`:root` 上定义为全局变量
- 运行时有效，可用 JS 动态修改
- 有级联特性，可在局部范围覆盖
- 适合主题切换、响应式、组件主题定制
- IE 不支持，需要 fallback 或 polyfill
