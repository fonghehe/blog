---
title: "CSS Style Queries 实战：用自定义属性驱动组件变体"
date: 2026-08-21 14:06:19
tags:
  - CSS
readingTime: 6
description: "CSS Style Queries（@container style(...)）进入 Baseline 2026，终于可以根据自定义属性的值来应用样式。本文聚焦实际用法：主题切换不靠 class、组件变体由 custom property 驱动、与 @property 的配合，以及降级策略。"
wordCount: 1221
---

Container Queries 解决了"根据容器尺寸响应"的问题，但它有一个盲区：你无法根据容器的状态（比如当前主题、密度模式、品牌色）来改变子组件样式。过去我们要么加一堆 class（`.dark`、`.compact`、`.brand-acme`），要么在 JS 里算好再传 props。Style Queries 补上了这块——它让你直接用 `@container style(...)` 查询自定义属性的值，把组件变体的控制权交还给 CSS。

## Style Queries 基础语法

Style Queries 的语法和 Size Container Queries 类似，但查询目标从尺寸变成了自定义属性：

```css
/* 声明一个 style query container */
.card-wrapper {
  container-type: normal; /* style queries 不需要 size containment */
}

/* 当 --theme 等于 dark 时 */
@container style(--theme: dark) {
  .card {
    background: #1a1a2e;
    color: #e0e0e0;
    border-color: #333;
  }
}

/* 当 --density 等于 compact 时 */
@container style(--density: compact) {
  .card {
    padding: 8px 12px;
    font-size: 0.875rem;
  }
}
```

注意 `container-type: normal`——style queries 不需要 `size` 或 `inline-size`，因为查询的是属性值而非尺寸。这意味着你可以给任何元素设置 style container，不会触发布局限制。

## 主题切换：告别全局 .dark class

传统暗色主题的典型做法是在 `<html>` 上加 `.dark` class，然后用后代选择器覆盖所有颜色。问题是当页面中需要同时存在明暗两种主题区域时（比如嵌入式 widget、预览面板），全局 class 就失效了。

用 Style Queries，主题作用域跟着容器走：

```css
/* 注册自定义属性，确保类型正确 */
@property --theme {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: light;
}

/* 主题容器 */
.theme-scope {
  container-type: normal;
  --theme: light;
}

.theme-scope[data-theme="dark"] {
  --theme: dark;
}

/* 组件样式根据容器主题自动切换 */
@container style(--theme: dark) {
  .button {
    background: var(--color-primary-dark);
    color: #fff;
  }

  .input {
    background: #2a2a3e;
    border-color: #444;
    color: #eee;
  }
}

@container style(--theme: light) {
  .button {
    background: var(--color-primary);
    color: #fff;
  }

  .input {
    background: #fff;
    border-color: #ddd;
    color: #333;
  }
}
```

```html
<!-- 同一页面中两个不同主题的区域 -->
<div class="theme-scope" data-theme="light">
  <div class="card">亮色区域的卡片</div>
</div>

<div class="theme-scope" data-theme="dark">
  <div class="card">暗色区域的卡片</div>
</div>
```

这里的关键是 `inherits: true`。`--theme` 会沿着 DOM 树向下继承，所以只需要在容器层级设置一次，内部所有子组件都能通过 style query 感知到。这比在每个组件上绑定 class 干净得多。

## 组件变体由 Custom Property 驱动

Style Queries 最有价值的场景是把组件变体从 class 组合爆炸中解放出来。以一个 Card 组件为例，它有尺寸（small/medium/large）、色调（neutral/accent/warning）、密度（comfortable/compact）三个维度。用 class 组合需要 3×3×3=27 个选择器；用 custom properties + style queries 只需要每个维度独立处理。

```css
/* 注册变体属性 */
@property --card-size {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: medium;
}

@property --card-tone {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: neutral;
}

@property --card-density {
  syntax: '<custom-ident>';
  inherits: true;
  initial-value: comfortable;
}

/* 基础样式 */
.card {
  container-type: normal;
  border-radius: 8px;
  transition: all 0.2s ease;
}

/* === 尺寸维度 === */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-size: medium) {
  .card { padding: 20px; font-size: 0.9375rem; }
}
@container style(--card-size: large) {
  .card { padding: 28px; font-size: 1.0625rem; }
}

/* === 色调维度 === */
@container style(--card-tone: neutral) {
  .card { background: var(--surface-1); border: 1px solid var(--border-subtle); }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border: 1px solid var(--color-primary); }
}
@container style(--card-tone: warning) {
  .card { background: var(--surface-warning); border: 1px solid var(--color-warning); }
}

/* === 密度维度 === */
@container style(--card-density: compact) {
  .card { gap: 4px; line-height: 1.4; }
  .card__actions { margin-top: 8px; }
}
@container style(--card-density: comfortable) {
  .card { gap: 12px; line-height: 1.6; }
  .card__actions { margin-top: 16px; }
}
```

使用侧只需要设置属性值：

```html
<div style="--card-size: large; --card-tone: accent; --card-density: compact;">
  <div class="card">
    <h3>大尺寸强调紧凑卡片</h3>
    <p>三个维度独立控制，无 class 组合。</p>
  </div>
</div>
```

在 Vue / React 组件中，这些 custom properties 可以通过 props 映射：

```vue
<template>
  <div
    :style="{
      '--card-size': size,
      '--card-tone': tone,
      '--card-density': density,
    }"
  >
    <div class="card">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  size?: 'small' | 'medium' | 'large'
  tone?: 'neutral' | 'accent' | 'warning'
  density?: 'compact' | 'comfortable'
}>()
</script>
```

组件模板完全不包含变体逻辑，所有视觉差异由 CSS style queries 处理。设计系统更新时只改 CSS，不改组件代码。

## 与 @property 的配合：为什么注册很重要

上面的例子都用了 `@property` 注册自定义属性。这不是可选的——如果不注册，浏览器会把自定义属性当作未类型化的字符串，style query 的匹配行为可能不符合预期。

具体来说：

| 特性 | 未注册属性 | @property 注册后 |
|------|-----------|-----------------|
| 语法检查 | 无 | 按 syntax 校验 |
| 继承行为 | 默认继承 | 由 inherits 控制 |
| 初始值 | 无（空值不匹配） | 有 initial-value |
| 动画支持 | 不支持 | 按 syntax 插值 |
| Style Query 匹配 | 仅精确字符串匹配 | 类型化匹配 |

一个容易踩的坑：未注册的属性如果值为空（比如某个祖先没设置），style query 不会匹配任何分支，组件会回退到基础样式。注册后有了 `initial-value`，始终有一个确定的匹配目标。

```css
/* 注册时指定非继承 + 初始值 */
@property --card-highlight {
  syntax: '<color>';
  inherits: false;
  initial-value: transparent;
}

/* 只在显式设置了高亮色的容器中生效 */
@container style(--card-highlight) {
  .card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--card-highlight);
  }
}
```

这里 `@container style(--card-highlight)` 不带冒号和值，表示"只要该属性存在且非初始值就匹配"。这是 style queries 的一个便捷写法，适合开关型的变体。

## 降级策略：不支持 Style Queries 怎么办

截至 2026 年 8 月，Style Queries 已经是 Baseline Newly Available，Chrome 136+、Firefox 138+、Safari 18.4+ 均支持。但仍有一部分用户停留在旧版本，降级方案需要提前考虑。

**策略一：@supports 检测 + class fallback**

```css
/* 现代浏览器：用 style queries */
@supports (container-type: normal) and (style(--theme: dark)) {
  @container style(--theme: dark) {
    .card { background: #1a1a2e; color: #e0e0e0; }
  }
}

/* 降级：用传统 class */
@supports not ((container-type: normal) and (style(--theme: dark))) {
  .theme-dark .card { background: #1a1a2e; color: #e0e0e0; }
}
```

**策略二：渐进增强——基础样式保底**

把最通用的变体作为默认样式，style queries 只做增强。这样即使不支持，组件也有可用的外观：

```css
/* 默认 = neutral + medium + comfortable */
.card {
  padding: 20px;
  font-size: 0.9375rem;
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
}

/* style queries 覆盖非默认值 */
@container style(--card-size: small) {
  .card { padding: 12px; font-size: 0.8125rem; }
}
@container style(--card-tone: accent) {
  .card { background: var(--surface-accent); border-color: var(--color-primary); }
}
```

我推荐策略二。它不需要维护两套选择器，降级体验只是回到默认外观而非完全错乱。对于面向公众的内容站，这个 trade-off 是可以接受的。

## 与 Size Container Queries 的组合

Style Queries 和 Size Container Queries 可以在同一个容器上叠加使用：

```css
.card-wrapper {
  container-type: inline-size; /* 同时支持 size 和 style queries */
  --card-tone: neutral;
}

/* 窄容器 + accent 色调 */
@container (max-width: 300px) and style(--card-tone: accent) {
  .card {
    flex-direction: column;
    border-left: none;
    border-top: 3px solid var(--color-primary);
  }
}

/* 宽容器 + accent 色调 */
@container (min-width: 301px) and style(--card-tone: accent) {
  .card {
    flex-direction: row;
    border-top: none;
    border-left: 3px solid var(--color-primary);
  }
}
```

这种组合能力是 class 方案几乎不可能优雅实现的——你需要为每种尺寸×状态的组合写一个独立 class，而 CSS 原生就能表达这个二维关系。

## 小结

Style Queries 填补了 CSS 条件样式的一块关键空白：基于状态而非尺寸的响应式设计。在实际项目中，它的最大价值是消除 class 组合爆炸和减少 JS 层的样式逻辑。配合 `@property` 注册获得类型安全，配合 `@supports` 做好降级，配合 Size Container Queries 实现多维响应。如果你的设计系统还在用大量 modifier class 管理变体，Style Queries 是一个值得投入的重构方向。它不是替代现有方案的银弹，但在组件变体管理和局部主题切换这两个场景中，确实比之前的任何纯 CSS 方案都更直接。
