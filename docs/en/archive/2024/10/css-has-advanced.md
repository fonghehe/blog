---
title: "CSS :has() Selector Advanced Applications: 2024 Real-World Scenarios"
date: 2024-10-02 10:00:00
tags:
  - CSS
readingTime: 2
description: "`:has()` 伪类选择器自 2023 年底在主流浏览器全面落地后，2024 年已经完全可以投入生产使用（Chrome 105+、Firefox 121+、Safari 15.4+，全球支持率超过 92%）。它被称为\"父选择器\"，但实际上远比这强大——它可以根据**任意后代或兄弟**的状态来匹配元素。本文整理了 20"
wordCount: 267
---

`:has()` 伪类选择器自 2023 年底在主流浏览器全面落地后，2024 年已经完全可以投入生产使用（Chrome 105+、Firefox 121+、Safari 15.4+，全球支持率超过 92%）。它被称为"父选择器"，但实际上远比这强大——它可以根据**任意后代或兄弟**的状态来匹配元素。本文整理了 2024 年最有价值的实战场景。

## Basics: The Semantics of :has()

```css
/* 选中"包含 img 的 .card" */
.card:has(img) {
}

/* 选中"包含 :checked 的 li" */
li:has(input:checked) {
}

/* 选中"紧跟在 h2 后面的 p"（配合相邻兄弟选择器）*/
h2:has(+ p) {
}
/* 等价于"后面紧跟着 p 的 h2" */
```

## Scenario 1: Form Validation State Styles

```css
/* 输入框聚焦时，整个 form-group 高亮 */
.form-group:has(input:focus) {
  outline: 2px solid #0066ff;
  border-radius: 4px;
}

/* 包含 required 输入框的 label 显示星号 */
.form-group:has(input:required) .label::after {
  content: " *";
  color: #e53e3e;
}

/* 输入框有错误时，整个 form-group 变红 */
.form-group:has(input:invalid:not(:placeholder-shown)) {
  background: #fff5f5;
}

.form-group:has(input:invalid:not(:placeholder-shown)) .error-message {
  display: block; /* 显示错误提示 */
}
```

## Scenario 2: Card Layout Adaptive Media Content

```css
/* 含图片的卡片：图片全宽，无内边距 */
.card:has(> img:first-child) {
  padding: 0;
}

.card:has(> img:first-child) .card-content {
  padding: 16px;
}

/* 含视频的卡片：特殊宽高比容器 */
.card:has(video) {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

/* 含多张图片（gallery 卡片）：网格布局 */
.card:has(.image-gallery) {
  display: grid;
  grid-template-rows: auto 1fr;
}
```

## Scenario 3: Navigation and Menu State

```css
/* 导航项被激活时，高亮父导航组 */
.nav-group:has(.nav-item.active) {
  background: rgba(0, 102, 255, 0.05);
}

.nav-group:has(.nav-item.active) .nav-group-title {
  color: #0066ff;
  font-weight: 600;
}

/* 下拉菜单打开时，调整触发按钮样式 */
.dropdown:has(.dropdown-menu:not([hidden])) .trigger-btn {
  background: #f0f0f0;
  border-color: #0066ff;
}

/* 含子菜单的 li 添加展开箭头 */
nav li:has(ul)::after {
  content: " ›";
  opacity: 0.5;
}
```

## Scenario 4: Data Density-Aware Tables

```css
/* 当表格超过 6 列时，缩小字号和内边距 */
table:has(th:nth-child(7)) {
  font-size: 13px;
}

table:has(th:nth-child(7)) th,
table:has(th:nth-child(7)) td {
  padding: 6px 8px; /* 正常是 10px 12px */
}

/* 含复选框列的表格，第一列固定宽度 */
table:has(td input[type="checkbox"]) td:first-child {
  width: 40px;
  text-align: center;
}
```

## Scenario 5: Dialog/Modal Background Scroll Lock

```css
/* 当 body 内有打开的 dialog 时，禁止滚动 */
body:has(dialog[open]) {
  overflow: hidden;
}

/* 有遮罩层时，主内容模糊 */
body:has(.overlay.visible) main {
  filter: blur(2px);
  pointer-events: none;
}
```

## Scenario 6: Manual Light/Dark Mode Toggle

```css
/* 当 html 上有 data-theme="dark" 时，全局深色模式 */
/* 使用 :has() 让切换更灵活（不依赖 class 层级）*/
:root:has([data-theme="dark"]) {
  --bg: #1a1a1a;
  --text: #f0f0f0;
}

/* 用户的"暗模式开关"是某个 checkbox */
:root:has(#dark-mode-toggle:checked) {
  color-scheme: dark;
  --bg: #1a1a1a;
}
```

## Performance Notes

`:has()` 的计算比普通选择器更昂贵，因为需要检查后代：

```css
/* ✅ 性能较好：限制了查询范围 */
.specific-container:has(> .direct-child.active) {
}

/* ⚠️ 性能较差：全局扫描所有元素的所有后代 */
*:has(.some-class) {
}

/* ✅ 避免在大型列表中使用深层 :has() */
/* ❌ 如果列表有 10000 项，这会很慢 */
.list-item:has(.deeply > .nested > .element) {
}
```

## Summary

`:has()` 是 CSS 历史上少数几个真正改变编程模型的特性之一。2024 年浏览器支持率已超过 92%，可以放心用于生产（渐进增强方式降级也很简单）。本文列举的表单状态、卡片布局、导航菜单、Modal 锁定等场景，每一个都曾经需要 JavaScript 来实现，现在纯 CSS 即可搞定。
