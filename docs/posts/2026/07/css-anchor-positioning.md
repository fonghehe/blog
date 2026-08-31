---
title: "CSS Anchor Positioning 实战：声明式定位的新范式"
date: 2026-07-08 14:50:02
tags:
  - CSS
readingTime: 8
description: "CSS Anchor Positioning API 让浮动元素的定位从 JavaScript 回归 CSS。本文详解 anchor-name、position-anchor、position-try 等核心属性，通过 Tooltip、Popover、Dropdown 的纯 CSS 实现展示声明式定位的实践。"
wordCount: 1594
---

前端开发中，浮动元素的定位一直是个让人头疼的问题。Tooltip、Popover、Dropdown 这些组件的核心需求很简单——"贴着某个元素显示"，但实现起来却需要处理边界检测、翻转、偏移、滚动跟随等一整套逻辑。Floating UI、Popper.js 等库的存在本身就说明了这个问题的复杂度。CSS Anchor Positioning API 的出现，让这一切回归到 CSS 的声明式范式。

## 核心概念与浏览器支持

Anchor Positioning 的核心思想是：一个元素可以声明"我要锚定到另一个元素"，然后通过 CSS 属性描述相对于锚点的位置关系。浏览器负责处理边界检测和翻转。

截至 2026 年 7 月，Anchor Positioning 的浏览器支持情况：

| 浏览器 | 版本 | 支持状态 |
|--------|------|----------|
| Chrome | 125+ | 完整支持 |
| Edge | 125+ | 完整支持 |
| Safari | 26+ | 完整支持 |
| Firefox | 138+ | 完整支持 |
| Safari iOS | 26+ | 完整支持 |

Chrome 125 在 2024 年 5 月率先支持，到 2026 年主流浏览器已全部跟上。这意味着在生产环境中使用 Anchor Positioning 已经是可行方案，但仍需提供 fallback。

## anchor-name 与 position-anchor

两个核心属性构成 Anchor Positioning 的基础：

```css
/* 锚点元素：声明自己的锚点名称 */
.anchor-button {
  anchor-name: --tooltip-anchor;
}

/* 浮动元素：声明自己锚定到谁 */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;
  /* 相对于锚点定位 */
  top: anchor(bottom);
  left: anchor(center);
  /* 水平居中对齐锚点 */
  translate: -50% 0;
}
```

`anchor-name` 在锚点元素上定义一个自定义标识符（必须以 `--` 开头）。`position-anchor` 在浮动元素上引用这个标识符，建立锚定关系。

`anchor()` 函数是定位的核心，它接受一个方向参数：

- `anchor(top)` — 锚点元素的上边缘
- `anchor(bottom)` — 锚点元素的下边缘
- `anchor(left)` — 锚点元素的左边缘
- `anchor(right)` — 锚点元素的右边缘
- `anchor(center)` — 锚点元素的水平中心
- `anchor(center, 50%)` — 垂直中心（第二个参数指定百分比）

## 完整 Tooltip 实现

结合 `popover` API 实现一个纯 CSS 的 Tooltip：

```html
<style>
  .tooltip-trigger {
    anchor-name: --trigger-anchor;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tooltip {
    popover: auto;
    position: fixed;
    position-anchor: --trigger-anchor;
    /* 定位到锚点上方 */
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    /* 间距 */
    margin-bottom: 8px;

    background: #1f2937;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;

    /* 入场动画 */
    transition: opacity 0.2s, transform 0.2s;
    transform-origin: bottom center;
  }

  .tooltip:popover-open {
    opacity: 1;
  }

  .tooltip::backdrop {
    background: transparent;
  }
</style>

<button class="tooltip-trigger" popovertarget="my-tooltip">
  悬停查看提示
</button>

<div class="tooltip" id="my-tooltip" role="tooltip">
  这是一个纯 CSS Tooltip
</div>
```

不需要一行 JavaScript。`popover` API 处理显示/隐藏，`position-anchor` 处理定位。

## position-try Fallback 策略

Tooltip 在视口边缘会被截断。`position-try` 让浏览器自动尝试其他位置：

```css
.tooltip {
  position: fixed;
  position-anchor: --trigger-anchor;

  /* 默认位置：上方 */
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;

  /* Fallback：如果上方空间不够，按顺序尝试其他位置 */
  position-try: flip-block flip-inline;
}

/* 也可以显式定义 fallback 列表 */
.tooltip-explicit {
  position: fixed;
  position-anchor: --trigger-anchor;
  bottom: anchor(top);
  left: anchor(center);

  /* 显式列出所有备选位置 */
  position-try-options: --top, --bottom, --left, --right;
}

@position-try --top {
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;
}

@position-try --bottom {
  top: anchor(bottom);
  left: anchor(center);
  transform: translateX(-50%);
  margin-top: 8px;
}

@position-try --left {
  right: anchor(left);
  top: anchor(center);
  transform: translateY(-50%);
  margin-right: 8px;
}

@position-try --right {
  left: anchor(right);
  top: anchor(center);
  transform: translateY(-50%);
  margin-left: 8px;
}
```

`position-try: flip-block` 的行为：当默认位置空间不够时，浏览器自动翻转——上方变下方，下方变上方。`flip-inline` 则左右翻转。组合使用 `flip-block flip-inline` 可以覆盖四个方向。

`@position-try` 规则则提供了完全自定义的能力。浏览器按 `position-try-options` 列出的顺序逐个尝试，直到找到能完整显示的位置。

### position-try-fallbacks 优先级控制

```css
.dropdown {
  position: fixed;
  position-anchor: --dropdown-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  /* 策略 1：先尝试翻转，再尝试移动 */
  position-try: flip-block;

  /* 策略 2：允许溢出但不改变尺寸 */
  position-try: flip-block allow-overflow;

  /* 策略 3：翻转后如果还放不下，改变对齐方式 */
  position-try: flip-block shift-inline;
}
```

`allow-overflow` 允许浮动元素溢出视口而非翻转，适用于内容不可裁剪的场景。`shift-inline` 在翻转后仍放不下时，沿水平方向滑动而非保持居中对齐。

## Dropdown 实现与交互样式

```css
.dropdown-menu {
  popover: auto;
  position: fixed;
  position-anchor: --menu-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  min-width: 200px;
  padding: 4px;

  position-try: flip-block;

  /* 入场动画 */
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.dropdown-menu:popover-open {
  opacity: 1;
  transform: scaleY(1);
}

.dropdown-menu:not(:popover-open) {
  opacity: 0;
  transform: scaleY(0.9);
}

.dropdown-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-item:hover {
  background: #f3f4f6;
}
```

```html
<button class="menu-trigger" popovertarget="menu" style="anchor-name: --menu-trigger">
  菜单
  <svg width="12" height="12"><!-- arrow icon --></svg>
</button>

<div class="dropdown-menu" id="menu" role="menu">
  <div class="dropdown-item" role="menuitem">编辑</div>
  <div class="dropdown-item" role="menuitem">复制</div>
  <div class="dropdown-item" role="menuitem">删除</div>
</div>
```

## 与 JavaScript 定位方案的对比

以 Floating UI 为例，实现同等功能需要的代码量：

```typescript
// Floating UI 实现
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'

const trigger = document.querySelector('.trigger')
const tooltip = document.querySelector('.tooltip')

function update() {
  computePosition(trigger, tooltip, {
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    })
  })
}

autoUpdate(trigger, tooltip, update)

// 还需要手动处理显示/隐藏
trigger.addEventListener('mouseenter', () => {
  tooltip.style.display = 'block'
  update()
})
trigger.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none'
})
```

| 维度 | CSS Anchor Positioning | Floating UI / Popper.js |
|------|----------------------|------------------------|
| 代码量 | ~20 行 CSS | ~30 行 JS + 依赖包 |
| 运行时性能 | 浏览器原生，零开销 | ResizeObserver + scroll 监听 |
| 包体积 | 0 KB | 3-15 KB（gzip） |
| SSR 友好 | 是（纯 CSS） | 否（需要客户端 hydration） |
| 灵活性 | 有限的 fallback 策略 | 完全可编程的 middleware |
| 浏览器兼容 | 2026 主流全覆盖 | 全兼容（IE11+） |
| 动态内容 | 自动跟随 | 需要手动调用 update |

Anchor Positioning 在简单场景下几乎可以完全替代 JS 方案。但在需要复杂逻辑（如 sticky 定位、虚拟化列表内的 tooltip、跨 iframe 定位）时，Floating UI 仍然更合适。

## 无障碍（a11y）考虑

Popover API 的 `popover` 属性自带部分无障碍特性：

- `popover="auto"` 会自动处理焦点陷阱（focus trap）
- 按 Escape 自动关闭
- 点击外部自动关闭
- `aria-expanded` 需要手动管理

```html
<button
  class="tooltip-trigger"
  popovertarget="my-tooltip"
  aria-describedby="my-tooltip"
  style="anchor-name: --trigger-anchor"
>
  操作按钮
</button>

<div
  class="tooltip"
  id="my-tooltip"
  role="tooltip"
  popover="auto"
>
  点击此按钮执行操作
</div>
```

`role="tooltip"` 配合 `aria-describedby` 确保屏幕阅读器能正确关联提示信息。对于 Dropdown 类组件，需要手动实现键盘导航：

```javascript
// 最小化的键盘导航补充
const menu = document.querySelector('#menu')
const trigger = document.querySelector('[popovertarget="menu"]')

trigger.addEventListener('click', () => {
  if (menu.matches(':popover-open')) {
    const firstItem = menu.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }
})

menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role="menuitem"]')]
  const currentIndex = items.indexOf(document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(currentIndex + 1) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(currentIndex - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Escape') {
    trigger.focus()
  }
})
```

## 浏览器兼容性处理

使用 `@supports` 检测并提供 fallback：

```css
/* Fallback: 不支持 Anchor Positioning 时使用绝对定位 */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

@supports (anchor-name: --x) {
  .tooltip {
    position: fixed;
    position-anchor: --trigger-anchor;
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    margin-top: 0;
    margin-bottom: 8px;
  }
}
```

对于需要完整 fallback 的项目，可以使用 `@floating-ui/dom` 作为 polyfill：

```javascript
// 检测是否支持 Anchor Positioning
const supportsAnchor = CSS.supports('anchor-name: --x')

if (!supportsAnchor) {
  // 降级到 Floating UI
  const { autoUpdate, computePosition, offset, flip, shift } = await import(
    '@floating-ui/dom'
  )
  // 初始化所有 .tooltip 元素
}
```

渐进增强策略：现代浏览器获得原生体验，旧浏览器使用 JS fallback，两种方案通过 `@supports` 切换。

## 优缺点分析

**优点：**

- 零 JavaScript 运行时开销，定位计算由浏览器原生完成
- 与 Popover API 深度整合，显示/隐藏/定位一体化
- 声明式语法比命令式 JS 更易维护
- 自动处理滚动、resize 等边界场景
- SSR 友好，不依赖客户端 JS

**缺点：**

- Fallback 策略不如 Floating UI 灵活，复杂场景受限
- 动态锚点（如列表项的 tooltip）需要动态设置 `anchor-name`，仍需少量 JS
- 动画控制受限于 CSS transition，无法实现基于物理的弹性动画
- 跨容器定位（如 modal 内的 tooltip）存在 stacking context 问题
- 调试工具不完善，Chrome DevTools 对 anchor 关系的可视化仍需改进

## 未来展望

CSS Anchor Positioning Level 2 正在讨论以下扩展：

- `anchor-scroll` — 支持锚点在滚动容器内的定位
- `anchor-pos` — 更精细的位置控制，支持百分比和计算
- 与 View Transitions API 的集成 — 定位变化时的平滑过渡
- `anchor-match` — 基于锚点状态的条件样式

这些扩展将进一步缩小与 JS 方案的能力差距。

## 个人观点

Anchor Positioning 是 CSS 回归声明式本质的又一个里程碑。从 Flexbox 到 Grid 到 Container Queries 再到 Anchor Positioning，CSS 正在逐步收回被 JavaScript 占据的领域。对于绝大多数 Tooltip 和 Dropdown 场景，纯 CSS 方案已经足够，而且性能更好、代码更少。

但我不建议在生产环境中完全抛弃 Floating UI。原因有两点：一是兼容性过渡期需要 polyfill，二是复杂场景（如富文本编辑器内的浮动菜单）仍然需要 JS 的精确控制。务实的做法是：简单场景用 CSS，复杂场景用 JS，通过 `@supports` 让两者共存。

## 小结

CSS Anchor Positioning 通过 `anchor-name`、`position-anchor` 和 `anchor()` 函数实现了声明式定位，`position-try` 处理边界翻转。配合 Popover API，可以在纯 CSS 中实现完整的 Tooltip、Dropdown 组件。与 Floating UI 相比，它零运行时开销、SSR 友好，但灵活性有限。在 2026 年的浏览器环境下，Anchor Positioning 已具备生产可用性，建议采用渐进增强策略：原生优先，JS fallback 兜底。
