---
title: "CSS 动画性能：transform 和 opacity"
date: 2018-10-03 11:29:08
tags:
  - CSS
readingTime: 1
description: "做了一个滑入动画，手机上卡顿明显。排查后发现是用了 `margin`/`top` 做动画，改成 `transform` 之后流畅了很多。"
---

做了一个滑入动画，手机上卡顿明显。排查后发现是用了 `margin`/`top` 做动画，改成 `transform` 之后流畅了很多。

## 为什么 transform 快

浏览器渲染流水线：

```
JavaScript → Style → Layout → Paint → Composite
（JS执行）  （样式计算）（布局）（绘制） （合成）
```

不同属性触发的流程不同：

```
left/top/margin/width/height → 触发 Layout（重排）+ Paint + Composite
  - 改变了元素的几何信息
  - 需要重新计算所有相关元素的位置
  - 最慢

background/color/visibility → 触发 Paint（重绘）+ Composite
  - 不改变几何，但要重新画像素
  - 中等

transform/opacity → 只触发 Composite（合成）
  - 不影响文档流，由 GPU 在独立的层上处理
  - 最快
```

## 实践对比

```css
/* ❌ 慢：触发重排 */
@keyframes slide-in-bad {
  from {
    left: -100px;
  }
  to {
    left: 0;
  }
}

/* ✅ 快：只触发合成 */
@keyframes slide-in-good {
  from {
    transform: translateX(-100px);
  }
  to {
    transform: translateX(0);
  }
}

/* ❌ 慢：改变尺寸触发重排 */
@keyframes expand-bad {
  from {
    width: 100px;
    height: 100px;
  }
  to {
    width: 200px;
    height: 200px;
  }
}

/* ✅ 快：用 scale 代替 */
@keyframes expand-good {
  from {
    transform: scale(0.5);
  }
  to {
    transform: scale(1);
  }
}
```

## will-change：提示浏览器提前准备

```css
/* 提示浏览器这个元素会有动画，提前创建合成层 */
.animated-element {
  will-change: transform;
}

/* 或者用 translateZ(0) 的黑魔法（老方法，不推荐）*/
.animated-element {
  transform: translateZ(0);
}
```

**注意**：不要滥用 `will-change`，每个合成层会占用额外内存：

```css
/* ❌ 给所有元素加（每个都创建合成层，内存爆炸）*/
* {
  will-change: transform;
}

/* ✅ 只在真正需要动画的元素上加，动画结束后移除 */
.card:hover {
  will-change: transform;
}
```

## 用 JS 控制 will-change

```javascript
// 更精细的控制：hover 时加，离开时移除
element.addEventListener("mouseenter", () => {
  element.style.willChange = "transform";
});
element.addEventListener("animationend", () => {
  element.style.willChange = "auto"; // 释放资源
});
```

## 调试工具

Chrome DevTools → Rendering 面板：

- **Paint flashing**：绿色高亮显示哪些区域在重绘，面积越大越慢
- **Layer borders**：显示合成层边界，了解有多少层
- **FPS meter**：实时帧率

## 流畅动画的实践

```css
/* 完整的流畅卡片悬停效果 */
.card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  will-change: transform;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 注意：box-shadow 变化会触发 Paint，但比 margin 好 */
```

## 小结

- `transform` 和 `opacity` 只触发合成，是最快的动画属性
- 避免动画 `left/top/width/height/margin`（触发重排）
- `will-change: transform` 告知浏览器提前准备，但不要滥用
- 用 DevTools 的 Paint flashing 验证重绘范围
