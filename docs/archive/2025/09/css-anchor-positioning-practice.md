---
title: "CSS Anchor Positioning：2025 年从实验到实战"
date: 2025-09-24 10:00:00
tags:
  - CSS
readingTime: 2
description: "CSS Anchor Positioning（CSS 锚点定位）在 2024 年进入 Chrome 125+ 后，2025 年随着 Firefox 和 Safari 的跟进，终于达到了可以实际使用的支持度（全球 ~78%）。它解决了前端长期依赖 JavaScript 计算位置的\"悬浮 UI\"问题：Tooltip、Pop"
wordCount: 292
---

CSS Anchor Positioning（CSS 锚点定位）在 2024 年进入 Chrome 125+ 后，2025 年随着 Firefox 和 Safari 的跟进，终于达到了可以实际使用的支持度（全球 ~78%）。它解决了前端长期依赖 JavaScript 计算位置的"悬浮 UI"问题：Tooltip、Popover、下拉菜单、浮动面板——这些全靠锚点定位就能实现，无需 Popper.js、Floating UI 等库。

## 核心概念：锚点与定位元素

```css
/* 1. 定义锚点（被引用的元素）*/
.trigger-button {
  anchor-name: --my-anchor; /* 给元素起一个锚点名称 */
}

/* 2. 定位元素：相对锚点定位 */
.tooltip {
  position: absolute; /* 必须是绝对/固定定位 */
  position-anchor: --my-anchor; /* 绑定到锚点 */

  /* anchor() 函数：引用锚点的各条边 */
  bottom: anchor(top); /* 紧贴锚点的上边缘 */
  left: anchor(left); /* 左对齐 */

  /* 水平居中于锚点 */
  left: calc(anchor(left) + (anchor(width) / 2));
  translate: -50% 0;
}
```

## 实战：纯 CSS Tooltip

```html
<button class="btn" popovertarget="tip">
  悬停查看提示
  <span id="tip" popover>这是一个纯 CSS Tooltip，无需 JS！</span>
</button>
```

```css
.btn {
  anchor-name: --btn-anchor;
  position: relative; /* 作为 containing block */
}

#tip {
  position: fixed; /* fixed 才能相对锚点定位到视口任意位置 */
  position-anchor: --btn-anchor;

  /* 默认显示在按钮上方居中 */
  bottom: calc(anchor(top) - 8px);
  left: anchor(center);
  translate: -50% 0;

  /* 样式 */
  background: #1a1a2e;
  color: white;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
}

/* 箭头 */
#tip::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  border: 6px solid transparent;
  border-top-color: #1a1a2e;
}
```

## @position-try：自动翻转（溢出处理）

当锚点靠近视口边缘时，弹出层需要自动翻转方向：

```css
.popover {
  position: fixed;
  position-anchor: --trigger;

  /* 默认：显示在下方 */
  top: anchor(bottom);
  left: anchor(left);

  /* 自动翻转规则 */
  position-try-fallbacks:
    --above,
    /* 尝试方案 1 */ --left,
    /* 尝试方案 2 */ --right; /* 尝试方案 3 */
}

/* 定义翻转方案 */
@position-try --above {
  top: auto;
  bottom: anchor(top); /* 显示在上方 */
}

@position-try --left {
  left: auto;
  right: anchor(left); /* 显示在左侧 */
}

@position-try --right {
  left: anchor(right); /* 显示在右侧 */
}
```

## 实战：下拉选择菜单（Select 替代品）

```css
/* 触发按钮 */
.select-trigger {
  anchor-name: --select-trigger;
}

/* 下拉列表 */
.select-dropdown {
  position: fixed;
  position-anchor: --select-trigger;

  /* 与触发按钮同宽，显示在其正下方 */
  top: anchor(bottom);
  left: anchor(left);
  width: anchor-size(width); /* anchor-size()：获取锚点尺寸 */
  min-width: 120px;

  position-try-fallbacks: --above;
  margin-top: 4px;

  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

@position-try --above {
  top: auto;
  bottom: calc(anchor(top) - 4px);
}
```

## 与 Floating UI 的对比

```
                  Floating UI/Popper.js    CSS Anchor Positioning
────────────────────────────────────────────────────────────────
实现方式          JavaScript              纯 CSS
包体积            ~12KB gzip              0（浏览器原生）
动态计算          每次滚动/resize 重算    浏览器自动处理
自动翻转          手动配置 middleware     @position-try
SSR 兼容          需要处理 hydration      无问题
浏览器支持        全部                   ~78%（2025年9月）
复杂场景          更灵活                 有限制
```

**推荐策略**：新项目可以用 CSS Anchor Positioning 处理简单场景（Tooltip、下拉），复杂交互（有动画、复杂对齐逻辑）仍可保留 Floating UI。

## 总结

CSS Anchor Positioning 是"JavaScript 做 CSS 工作的历史终于结束了"的又一个例子。2025 年随着 Firefox 支持到来，它已经到了"渐进增强使用"的阶段。对于内部工具和 B 端系统（可以要求现代浏览器），现在完全可以用它替代 Popper.js/Floating UI 的基础场景。
