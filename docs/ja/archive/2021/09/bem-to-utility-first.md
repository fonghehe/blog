---
title: "CSS アーキテクチャの進化：BEM から Utility-First へ"
date: 2021-09-27 14:31:11
tags:
  - CSS

readingTime: 2
description: "今年在团队内推动了一次 CSS 架构的升级——从 BEM 命名规范逐步迁移到 Utility-First 方案。过程中有争论、有妥协，最终找到了一个平衡点。"
---

今年在团队内推动了一次 CSS 架构的升级——从 BEM 命名规范逐步迁移到 Utility-First 方案。过程中有争论、有妥协，最终找到了一个平衡点。

## BEM の課題

BEM（Block-Element-Modifier）我们用了 4 年，解决了命名冲突问题，但随着项目变大，新问题逐渐暴露：

```css
/* BEM 的典型代码 */
.card { }
.card__header { }
.card__header__title { }
.card__header__title--highlighted { }
.card__body { }
.card__body__content { }
.card__body__content--loading { }

/* 问题一：嵌套层级深时命名爆炸 */
.data-table__row__cell__link__icon--active { }

/* 问题二：每个组件都要写一大堆 CSS */
/* card.css - 200+ 行，其中 60% 是布局和间距 */
.card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 12px;
}
/* 这些 flex、padding、margin 在无数组件中重复 */
```

核心问题是：CSS 文件膨胀、布局样式重复、命名心智负担高。

## Utility-First の利点

```html
<!-- 以前：HTML + 对应的 BEM CSS -->
<div class="card">
  <div class="card__header">
    <h3 class="card__header__title">标题</h3>
  </div>
</div>

<!-- Utility-First：样式直接在 HTML 中 -->
<div class="rounded-lg bg-white shadow-md">
  <div class="flex items-center justify-between p-4 mb-3">
    <h3 class="text-lg font-semibold text-gray-900">标题</h3>
  </div>
</div>
```

优点很明显：不用在 HTML 和 CSS 之间跳转，不用想命名，样式一目了然。但初期团队的抵触也很大——"HTML 太丑了"、"和内联样式有什么区别"。

## 私たちの妥協案

没有全盘用 Utility-First，而是分层处理：

```html
<!-- 1. 布局用 utility classes -->
<div class="grid grid-cols-3 gap-4 p-6">
  <!-- 2. 组件语义部分用 BEM -->
  <article class="card">
    <div class="card__header">
      <!-- 3. 细节调整用 utility classes -->
      <h3 class="card__title text-lg mb-1">标题</h3>
      <span class="card__badge bg-red-500 text-white px-2 py-0.5 rounded">
        NEW
      </span>
    </div>
    <div class="card__body text-gray-600">
      内容
    </div>
  </article>
</div>
```

原则是：
- **布局和间距**：用 utility classes，不写 CSS
- **组件的结构样式**：用 BEM，保持语义
- **颜色和字体微调**：用 utility classes

## CSS変数でDesign Tokenを統一する

不管用什么 CSS 方法论，Design Token 都应该统一管理：

```css
:root {
  /* 间距系统 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* 颜色系统 */
  --color-primary: #1890ff;
  --color-text: #333;
  --color-text-secondary: #666;

  /* 字体 */
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* 组件中使用 */
.card {
  border-radius: var(--radius-md);
  padding: var(--space-4);
  color: var(--color-text);
}
```

## ツールチェーン設定

我们用 Windi CSS（兼容 Tailwind 的 API）作为 utility 工具，配合 Vite 使用：

```javascript
// vite.config.ts
import WindiCSS from 'vite-plugin-windicss'

export default {
  plugins: [
    WindiCSS({
      scan: {
        dirs: ['src'],
        fileExtensions: ['vue', 'ts', 'jsx']
      }
    })
  ]
}
```

Windi CSS 的按需生成特性让最终 CSS 体积很小，而且 JIT 模式下所有 utility 都是按需编译的。

## まとめ

- BEM 不是过时了，而是在布局和间距层面过于冗余
- Utility-First 不适合全盘采用，和 BEM 结合使用是更好的方案
- Design Token 用 CSS 变量管理，不管用什么方法论都需要
- Windi CSS / Tailwind JIT 让 Utility-First 方案的运行时开销几乎为零
- 团队接受度需要渐进式推进，先从布局样式开始