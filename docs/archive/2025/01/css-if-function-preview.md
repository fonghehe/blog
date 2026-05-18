---
title: "CSS if() 函数：2025 年最期待的 CSS 新原语"
date: 2025-01-15 10:00:00
tags:
  - CSS
readingTime: 2
description: "CSS `if()` 函数在 State of CSS 2023 调查中以\"最期待的新特性\"高票通过后，2025 年终于迎来了浏览器实验性实现。它将允许在 CSS 属性值中内联书写条件逻辑，彻底改变目前必须靠 CSS 变量 + 媒体查询 + 选择器拼凑的条件样式写法。"
---

CSS `if()` 函数在 State of CSS 2023 调查中以"最期待的新特性"高票通过后，2025 年终于迎来了浏览器实验性实现。它将允许在 CSS 属性值中内联书写条件逻辑，彻底改变目前必须靠 CSS 变量 + 媒体查询 + 选择器拼凑的条件样式写法。

> **注意**：截至 2025 年 1 月，`if()` 仍处于 CSS Working Group 规范草案阶段，Chrome 实验性标志后可用，尚未稳定。

## 当前痛点：条件样式的变通方案

```css
/* 现在要根据变量写条件样式，只能用选择器变通 */
:root {
  --is-dark: 0; /* 0 或 1 */
}

/* 利用 calc() hack（只适用于数值） */
.bg {
  /* (1 - var(--is-dark)) × 255 + var(--is-dark) × 0 */
  /* 0 → 255（白色），1 → 0（黑色）*/
  background: rgb(
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255),
    calc((1 - var(--is-dark)) * 255)
  );
}

/* 或者靠 CSS 选择器 :has()/:is() */
:root:has([data-theme="dark"]) .bg {
  background: black;
}
:root:not(:has([data-theme="dark"])) .bg {
  background: white;
}
```

## CSS if() 语法（规范草案）

```css
/* 基本语法 */
.element {
  color: if(style(--variant: primary): blue; else: gray);
}

/* 多条件 */
.button {
  background: if(
    style(--size: large): hsl(200 80% 40%) ;
      style(--size: small): hsl(200 80% 60%) ; else: hsl(200 80% 50%)
  );

  padding: if(
    style(--size: large): 12px 24px; style(--size: small): 4px 8px; else: 8px
      16px
  );
}

/* 使用 media 条件 */
.layout {
  display: if(media(width >= 768px): grid; else: flex);

  grid-template-columns: if(
    media(width >= 1024px): repeat(3, 1fr) ;
      media(width >= 768px): repeat(2, 1fr) ; else: 1fr
  );
}

/* 使用 supports 条件 */
.animation {
  animation-timeline: if(
    supports(animation-timeline: scroll()): scroll() ; else: none
  );
}
```

## if() 与自定义属性组合：组件变体系统

这是 `if()` 最强大的应用场景——无需修改 HTML 结构，纯靠 CSS 变量驱动组件变体：

```css
/* 定义一个支持 variant 和 size 变体的按钮 */
.button {
  --variant: primary; /* 默认值 */
  --size: md;

  /* 使用 if() 根据变量决定所有相关属性 */
  background: if(
    style(--variant: primary): var(--color-primary) ;
      style(--variant: secondary): transparent;
      style(--variant: danger): var(--color-danger) ; else: var(--color-primary)
  );

  color: if(style(--variant: secondary): var(--color-primary) ; else: white);

  border: if(
    style(--variant: secondary): 1px solid var(--color-primary) ; else: none
  );

  padding: if(
    style(--size: sm): 4px 10px; style(--size: lg): 12px 28px; else: 8px 16px
  );

  font-size: if(style(--size: sm): 13px; style(--size: lg): 17px; else: 15px);
}
```

```html
<!-- 仅通过 CSS 变量切换变体 -->
<button class="button" style="--variant: primary; --size: lg">
  大号主按钮
</button>
<button class="button" style="--variant: secondary">次要按钮</button>
<button class="button" style="--variant: danger; --size: sm">
  小号危险按钮
</button>
```

## 与现有方案的对比

```
方案对比（以"按钮变体"为例，3 种变体 × 3 种尺寸）：

方案               代码量    动态切换    运行时 JS    选择器特异性
─────────────────────────────────────────────────────────────────
CSS 类名 (.btn-primary-lg)    多        靠 JS     需要         累加
CSS 变量 + 计算 hack          多        CSS 变量   无           无影响
CSS 选择器 :has() 组合        较多      CSS 变量   无           有影响
CSS if()（未来）              少        CSS 变量   无           无影响
```

## 目前如何试用

```bash
# Chrome 125+ 开启实验标志
# 地址栏输入：chrome://flags
# 搜索：CSS if()
# 或：--enable-experimental-web-platform-features
```

```css
/* 或通过 PostCSS 插件转换（polyfill 方案，部分兼容）*/
/* postcss-if-value 等插件正在开发中 */
```

## 总结

CSS `if()` 代表了 CSS 条件逻辑的未来方向——将组件变体的逻辑内联到 CSS 中，减少对 JavaScript 的依赖，同时让 CSS 变量真正成为"主题/状态的单一来源"。虽然 2025 年初仍不适合生产使用，但值得现在就了解语法，等稳定化之后可以快速迁移。
