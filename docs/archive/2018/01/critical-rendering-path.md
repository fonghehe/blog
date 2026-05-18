---
title: "前端性能优化：搞懂关键渲染路径"
date: 2018-01-11 17:34:30
tags:
  - 性能优化
readingTime: 3
description: "做性能优化之前，得先搞清楚浏览器从收到 HTML 到用户看到页面，中间经历了什么。这些步骤合在一起叫做**关键渲染路径**（Critical Rendering Path）。不理解这个，很多优化手段只能照猫画虎。"
---

做性能优化之前，得先搞清楚浏览器从收到 HTML 到用户看到页面，中间经历了什么。这些步骤合在一起叫做**关键渲染路径**（Critical Rendering Path）。不理解这个，很多优化手段只能照猫画虎。

## 浏览器渲染的五个步骤

1. **解析 HTML，构建 DOM 树**
2. **解析 CSS，构建 CSSOM 树**
3. **合并 DOM 和 CSSOM，生成渲染树（Render Tree）**
4. **布局（Layout/Reflow）**：计算每个节点的位置和大小
5. **绘制（Paint）**：把渲染树转换为屏幕上的像素

这五步里，1 和 2 是并行的，但有一个关键阻塞规则：**CSS 阻塞渲染，JS 阻塞解析**。

## CSS 阻塞渲染

浏览器必须等待 CSSOM 构建完成才能开始渲染。原因很简单：如果先渲染再等 CSS，用户会看到样式闪烁（FOUC，Flash of Unstyled Content）。

```html
<!-- 这个 CSS 文件的下载和解析会阻塞页面渲染 -->
<link rel="stylesheet" href="/styles/main.css" />
```

优化方向：

- 减小 CSS 文件体积，移除未用样式（PurgeCSS）
- 内联关键 CSS（首屏可见区域的样式）
- 非关键 CSS 异步加载

```html
<!-- 内联关键 CSS -->
<style>
  /* 仅包含首屏需要的样式 */
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .header {
    height: 60px;
    background: #fff;
  }
</style>

<!-- 非关键 CSS 异步加载 -->
<link
  rel="preload"
  href="/styles/non-critical.css"
  as="style"
  onload="this.rel='stylesheet'"
/>
```

## JS 阻塞 HTML 解析

当 HTML 解析器遇到 `<script>` 标签时，会**暂停 DOM 构建**，等待 JS 下载并执行完成。原因是 JS 可能修改 DOM（`document.write`）。

```html
<!-- 坏：阻塞 DOM 解析，首屏白屏时间长 -->
<head>
  <script src="/js/app.js"></script>
</head>

<!-- 好：放到 body 底部，DOM 解析完再执行 -->
<body>
  <!-- 页面内容 -->
  <script src="/js/app.js"></script>
</body>
```

更好的方式是用 `defer` 或 `async`：

```html
<!-- defer：异步下载，DOM 解析完成后按顺序执行 -->
<script defer src="/js/vendor.js"></script>
<script defer src="/js/app.js"></script>

<!-- async：异步下载，下载完立刻执行（不保证顺序） -->
<script async src="/js/analytics.js"></script>
```

`defer` 适合大多数应用脚本，`async` 适合独立的第三方脚本（统计、广告）。

## 重排（Reflow）和重绘（Repaint）

渲染完成后，修改 DOM 或样式会触发重新渲染：

- **重排**（Reflow/Layout）：元素几何属性改变，重新计算所有受影响元素的位置大小。代价最高。
- **重绘**（Repaint）：元素外观改变（颜色、背景），不影响布局。代价居中。
- **合成**（Composite）：仅影响 transform、opacity，在独立的合成层处理。代价最低。

```javascript
// 触发重排的属性（读取这些属性也会强制浏览器同步计算）
(element.offsetWidth, offsetHeight, offsetTop, offsetLeft);
(element.scrollWidth, scrollHeight, scrollTop);
(element.clientWidth, clientHeight);
window.getComputedStyle(element);

// 避免在循环里读写混合（强制同步布局）
// 坏：每次循环都强制浏览器重新计算布局
for (let i = 0; i < items.length; i++) {
  items[i].style.width = container.offsetWidth + "px"; // 读 + 写
}

// 好：先读后批量写
const containerWidth = container.offsetWidth; // 读一次
for (let i = 0; i < items.length; i++) {
  items[i].style.width = containerWidth + "px"; // 只写
}
```

## 利用合成层做高性能动画

把动画元素提升到独立的合成层，动画就不会触发重排和重绘：

```css
.animated-element {
  /* 提示浏览器这个元素会变化，提前创建合成层 */
  will-change: transform;

  /* 或者用旧方式强制创建合成层 */
  transform: translateZ(0);
}

/* 高性能动画：只用 transform 和 opacity */
@keyframes slide-in {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

不要滥用 `will-change`，每个合成层都占用 GPU 内存。页面上几百个元素都加 `will-change` 反而会让性能变差。

## 用 Chrome DevTools 找瓶颈

1. 打开 DevTools，切到 **Performance** 面板
2. 点击录制，执行操作，停止录制
3. 查看火焰图，重点关注：
   - 紫色的 **Layout** 块（重排）
   - 绿色的 **Paint** 块（重绘）
   - 找"长任务"（超过 50ms 的任务块）

一旦找到具体的重排/重绘触发点，对症下药比盲目优化效率高很多。

---

_下一篇：ES2017 async/await 最佳实践_
